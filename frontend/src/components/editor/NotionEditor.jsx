import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import tippy from 'tippy.js';
import debounce from 'lodash.debounce';
import { PenLine, Heading1, Heading2, List, CheckSquare, Text, Code, Quote, Image as ImageIcon } from 'lucide-react';

import client from '../../api/client';
import SlashCommand from './extensions/SlashCommand.js';
import BlockId from './extensions/BlockId.js';
import SuggestionList from './components/SuggestionList.jsx';
import BlockHandle from './components/BlockHandle.jsx';

const NotionEditor = ({ courseId }) => { 
  const [saveStatus, setSaveStatus] = useState('synced');
  const lastSavedJson = useRef(null);
  const isInitialMount = useRef(true);

  const handleImageUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await client.post('/upload/image', formData);
      const serverUrl = 'http://localhost:8080'; // 백엔드 서버 주소
      return serverUrl + response.data.url;
    } catch (error) {
      console.error("이미지 업로드 실패:", error);
      return null;
    }
  };

  const debouncedSaveToServer = useCallback(
    debounce(async (editor, id) => {
      const jsonContent = editor.getJSON();
      const plainText = editor.getText();
      const title = plainText.split('\n')[0].substring(0, 50) || '제목 없음';
      const previewText = plainText.substring(0, 200);

      if (JSON.stringify(jsonContent) === JSON.stringify(lastSavedJson.current)) return;
      
      setSaveStatus('saving');
      try {
        await client.post(`/notes/${id}`, { 
          title: title,
          content: JSON.stringify(jsonContent),
          previewText: previewText,
          searchContent: plainText
        });
        lastSavedJson.current = jsonContent;
        setSaveStatus('synced');
      } catch (error) {
        console.error("서버 저장 실패:", error);
        setSaveStatus('error');
      }
    }, 2000),
    []
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: '오늘의 강의 내용을 기록하세요. "/"를 입력해 명령어를 확인하세요...',
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image,
      BlockId,
      SlashCommand.configure({
        suggestion: {
          items: ({ query }) => {
            return [
              { 
                title: '텍스트', 
                icon: <Text size={18} />, 
                command: ({ editor, range }) => {
                  editor.chain().focus().deleteRange(range).setParagraph().run();
                }
              },
              { 
                title: '제목 1', 
                icon: <Heading1 size={18} />, 
                command: ({ editor, range }) => {
                  editor.chain().focus().deleteRange(range).setParagraph().toggleHeading({ level: 1 }).run();
                }
              },
              { 
                title: '제목 2', 
                icon: <Heading2 size={18} />, 
                command: ({ editor, range }) => {
                  editor.chain().focus().deleteRange(range).setParagraph().toggleHeading({ level: 2 }).run();
                }
              },
              { 
                title: '할 일 목록', 
                icon: <CheckSquare size={18} />, 
                command: ({ editor, range }) => {
                  editor.chain().focus().deleteRange(range).setParagraph().toggleTaskList().run();
                }
              },
              { 
                title: '불렛 리스트', 
                icon: <List size={18} />, 
                command: ({ editor, range }) => {
                  editor.chain().focus().deleteRange(range).setParagraph().toggleBulletList().run();
                }
              },
              { 
                title: '코드 블록', 
                icon: <Code size={18} />, 
                command: ({ editor, range }) => {
                  // 코드 블록 생성이 안 되는 문제를 해결하기 위해 setNode 사용 시도
                  editor.chain()
                    .focus()
                    .deleteRange(range)
                    .setParagraph()
                    .toggleCodeBlock()
                    .run();
                }
              },
              { 
                title: '인용구', 
                icon: <Quote size={18} />, 
                command: ({ editor, range }) => {
                  editor.chain().focus().deleteRange(range).setParagraph().toggleBlockquote().run();
                }
              },
              { 
                title: '이미지 업로드', 
                icon: <ImageIcon size={18} />, 
                command: ({ editor, range }) => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = async () => {
                    if (input.files?.length) {
                      const url = await handleImageUpload(input.files[0]);
                      if (url) {
                        editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
                      }
                    }
                  };
                  input.click();
                }
              },
            ].filter(item => item.title.toLowerCase().includes(query.toLowerCase()));
          },
          render: () => {
            let component;
            let popup;
            return {
              onStart: (props) => {
                component = new ReactRenderer(SuggestionList, { props, editor: props.editor });
                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },
              onUpdate(props) {
                component.updateProps(props);
                popup[0].setProps({ getReferenceClientRect: props.clientRect });
              },
              onKeyDown(props) {
                if (props.event.key === 'Escape') {
                  popup[0].hide();
                  return true;
                }
                return component.ref?.onKeyDown(props);
              },
              onExit() {
                popup[0].destroy();
                component.destroy();
              },
            };
          },
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'uninote-editor focus:outline-none min-h-[700px] text-lg leading-relaxed',
      },
      handleDrop: (view, event, slice, moved) => {
        // 1. 외부 파일 드롭 처리 (이미지 업로드)
        if (!moved && event.dataTransfer.files.length > 0) {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
            handleImageUpload(file).then(url => {
              if (url) {
                const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
                if (coordinates) {
                  editor.chain().focus().insertContentAt(coordinates.pos, {
                    type: 'image',
                    attrs: { src: url }
                  }).run();
                }
              }
            });
          }
          return true;
        }

        // 2. 기존 블록 드래그/드롭 처리
        if (!moved && event.dataTransfer.getData('block-drag')) {
          const { pos: fromPos, nodeSize, nodeJSON } = JSON.parse(event.dataTransfer.getData('block-drag'));
          const dropCoords = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (dropCoords) {
            let toPos = dropCoords.pos;
            if (fromPos < toPos) toPos -= nodeSize;
            editor.chain().deleteRange({ from: fromPos, to: fromPos + nodeSize }).insertContentAt(Math.max(0, toPos), nodeJSON).focus().run();
            return true;
          }
        }
        return false;
      }
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      localStorage.setItem(`note-temp-${courseId}`, JSON.stringify({ content: json, timestamp: Date.now() }));
      if (!isInitialMount.current) debouncedSaveToServer(editor, courseId);
    },
  });

  useEffect(() => {
    if (!editor || !courseId) return;
    const loadData = async () => {
      try {
        const res = await client.get(`/notes/${courseId}`);
        const serverData = res.data?.content ? JSON.parse(res.data.content) : null;
        const localData = JSON.parse(localStorage.getItem(`note-temp-${courseId}`) || 'null');
        let finalContent = (localData && (!serverData || localData.timestamp > (res.data?.updatedAt || 0))) ? localData.content : serverData;
        if (finalContent) {
          editor.commands.setContent(finalContent);
          lastSavedJson.current = finalContent;
        }
        setTimeout(() => { isInitialMount.current = false; }, 100);
      } catch (error) {
        console.error("데이터 로드 실패:", error);
        isInitialMount.current = false;
      }
    };
    loadData();
    return () => debouncedSaveToServer.cancel();
  }, [editor, courseId, debouncedSaveToServer]);

  return (
    <div className="relative">
      <div className="absolute -top-12 right-0 flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full border border-slate-100 z-10 shadow-sm">
        <div className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'saving' ? 'bg-blue-500 animate-pulse' : saveStatus === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} />
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'error' ? 'Error' : 'Synced'}
        </span>
      </div>

      <section className="relative min-h-[850px] bg-white rounded-[2.5rem] p-12 shadow-2xl shadow-slate-200/40 border border-slate-100 ring-1 ring-slate-50">
        <style>{`
          .uninote-editor { color: #1e293b; }
          .uninote-editor h1 { font-size: 2.5rem; font-weight: 800; margin-top: 1.5rem; margin-bottom: 1rem; line-height: 1.2; color: #0f172a; }
          .uninote-editor h2 { font-size: 1.875rem; font-weight: 700; margin-top: 1.25rem; margin-bottom: 0.75rem; color: #1e293b; }
          .uninote-editor p { margin-bottom: 0.75rem; line-height: 1.75; }
          .uninote-editor blockquote { border-left: 4px solid #e2e8f0; padding-left: 1rem; font-style: italic; color: #475569; margin: 1.5rem 0; }
          .uninote-editor img { max-width: 650px; width: 100%; height: auto; border-radius: 12px; margin: 1.5rem 0; border: 1px solid #f1f5f9; display: block; }
          
          /* 노션 스타일 코드 블록 */
          .ProseMirror pre {
            background: #f6f6f7;
            padding: 14px 16px;
            border-radius: 8px;
            margin: 12px 0;
            overflow-x: auto;
            border: 1px solid #e2e8f0;
          }
          .ProseMirror pre code {
            font-family: 'Fira Code', monospace;
            background: transparent;
            padding: 0;
            color: #1e293b;
            font-size: 0.9rem;
          }
          
          /* 인라인 코드 스타일 */
          .ProseMirror code {
            background: rgba(135,131,120,0.15);
            padding: 2px 4px;
            border-radius: 4px;
            font-family: 'Fira Code', monospace;
            font-size: 0.85em;
          }
          
          .uninote-editor ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
          .uninote-editor ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1rem; }
          .uninote-editor [data-type="taskList"] { list-style: none; padding: 0; }
          .uninote-editor [data-type="taskItem"] { display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.25rem; }
          .uninote-editor [data-type="taskItem"] input { margin-top: 0.4rem; cursor: pointer; }
          
          .ProseMirror > * { padding-left: 32px !important; position: relative; transition: background 0.2s; min-height: 1.5em; }
          .ProseMirror > *:hover { background: rgba(55, 53, 47, 0.04); border-radius: 6px; }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        `}</style>
        <div className="relative z-20">
          {editor && <BlockHandle editor={editor} />}
          <EditorContent editor={editor} />
        </div>
        <div className="absolute top-0 left-12 w-[1px] h-full bg-red-50/50" />
        <div className="absolute top-10 right-10 opacity-5">
          <PenLine size={120} className="text-slate-900" />
        </div>
      </section>
    </div>
  );
};

export default NotionEditor;
