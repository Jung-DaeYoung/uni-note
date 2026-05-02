import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import tippy from 'tippy.js';
import debounce from 'lodash.debounce';
import { 
  PenLine, 
  Heading1, 
  Heading2, 
  List, 
  CheckSquare, 
  Text, 
  Code, 
  Quote, 
  Image as ImageIcon,
  FilePlus,
  BrainCircuit
} from 'lucide-react';

import client from '../../api/client';
import SlashCommand from './extensions/SlashCommand.js';
import BlockId from './extensions/BlockId.js';
import PageLink from './extensions/PageLink.jsx';
import SuggestionList from './components/SuggestionList.jsx';
import BlockHandle from './components/BlockHandle.jsx';
import QuizConfigModal from './components/QuizConfigModal';
import CBTPlayer from './components/CBTPlayer';

// 첫 번째 블록을 제목으로 강제하는 커스텀 도큐먼트
const CustomDocument = Document.extend({
  content: 'heading block*',
});

const NotionEditor = ({ courseId, noteId, initialData, onSaved }) => { 
  const [saveStatus, setSaveStatus] = useState('synced');
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const lastSavedJson = useRef(null);
  const isInitialMount = useRef(true);
  const navigate = useNavigate();

  // 초기 콘텐츠 계산 로직을 함수로 분리
  const getInitialContent = () => {
    const serverData = initialData?.content ? JSON.parse(initialData.content) : null;
    const localData = JSON.parse(localStorage.getItem(`note-temp-${noteId}`) || 'null');
    
    // 로컬 스토리지 데이터가 서버 데이터보다 최신인 경우 우선 사용
    if (localData && (!serverData || localData.timestamp > (initialData?.updatedAt || 0))) {
      return localData.content;
    }
    
    if (serverData) return serverData;

    // 빈 텍스트 노드 에러 방지: title이 있을 때만 text 노드 생성
    const title = initialData?.title || '';
    return {
      type: 'doc',
      content: [{ 
        type: 'heading', 
        attrs: { level: 1 }, 
        content: title ? [{ type: 'text', text: title }] : [] 
      }]
    };
  };

  const handleImageUpload = async (file) => {
    // ... (기존 로직 유지)
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
      // ... (기존 로직 유지)
      const jsonContent = editor.getJSON();
      const titleNode = jsonContent.content[0];
      const title = titleNode?.content?.[0]?.text || '제목 없음';
      const plainText = editor.getText();
      const previewText = plainText.substring(title.length, title.length + 200).trim();

      if (JSON.stringify(jsonContent) === JSON.stringify(lastSavedJson.current)) return;
      
      setSaveStatus('saving');
      try {
        await client.put(`/notes/${id}`, { 
          title: title,
          content: JSON.stringify(jsonContent),
          previewText: previewText,
          searchContent: plainText
        });
        lastSavedJson.current = jsonContent;
        setSaveStatus('synced');
        if (onSaved) onSaved();
      } catch (error) {
        console.error("서버 저장 실패:", error);
        setSaveStatus('error');
      }
    }, 2000),
    [onSaved]
  );

  const editor = useEditor({
    extensions: [
      CustomDocument,
      StarterKit.configure({
        document: false, 
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: ({ node, pos }) => {
          if (pos === 0) return '제목을 입력하세요';
          return '오늘의 강의 내용을 기록하세요. "/"를 입력해 명령어를 확인하세요...';
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image,
      BlockId,
      PageLink,
      SlashCommand.configure({
        // ... (기존 suggestion 설정 유지)
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
                title: '하위 노트 추가', 
                icon: <FilePlus size={18} className="text-blue-500" />, 
                description: '현재 노트 아래에 새 페이지를 만듭니다.',
                command: async ({ editor, range }) => {
                  try {
                    const res = await client.post(`/courses/${courseId}/notes?parentNoteId=${noteId}`);
                    editor.chain()
                      .focus()
                      .deleteRange(range)
                      .insertContent({
                        type: 'pageLink',
                        attrs: {
                          noteId: res.data.noteId,
                          title: res.data.title
                        }
                      })
                      .run();
                  } catch (error) {
                    alert("하위 노트 생성에 실패했습니다.");
                  }
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
                  editor.chain().focus().deleteRange(range).setParagraph().toggleCodeBlock().run();
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
                if (popup && popup[0]) {
                  popup[0].destroy();
                  popup = null;
                }
                if (component) {
                  component.destroy();
                  component = null;
                }
              },
            };
          },
        },
      }),
    ],
    // 핵심 수정 부분: 초기 콘텐츠를 useEditor 단계에서 설정
    content: getInitialContent(),
    editorProps: {
      // ... (기존 editorProps 유지)
      attributes: {
        class: 'uninote-editor focus:outline-none min-h-[700px] text-lg leading-relaxed',
      },
      handleClickOn: (view, pos, node, nodePos, event, direct) => {
        if (node.type.name === 'pageLink') {
          const { noteId } = node.attrs;
          if (noteId) {
            navigate(`/course/${courseId}/note/${noteId}`);
            return true;
          }
        }
        return false;
      },
      handleDrop: (view, event, slice, moved) => {
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
      localStorage.setItem(`note-temp-${noteId}`, JSON.stringify({ content: json, timestamp: Date.now() }));
      if (!isInitialMount.current) debouncedSaveToServer(editor, noteId);
    },
  });

  // noteId가 바뀔 때 에디터 인스턴스는 유지하되 내용만 초기화해야 할 경우를 위해 남겨둠
  // 단, 부모에서 <NotionEditor key={noteId} />를 사용한다면 이 Effect는 아예 필요 없음
  useEffect(() => {
    if (!editor) return;

    // 만약 에디터에 이미 내용이 있고, 로드된 ID와 현재 ID가 다르다면 (부모에서 key를 안 썼을 경우 대비)
    const currentContent = editor.getJSON();
    const initialContent = getInitialContent();
    
    if (JSON.stringify(currentContent) !== JSON.stringify(initialContent)) {
      editor.commands.setContent(initialContent, false); // emitUpdate: false로 불필요한 저장 방지
    }

    lastSavedJson.current = initialContent;
    isInitialMount.current = false;

    return () => debouncedSaveToServer.cancel();
  }, [noteId, editor, initialData]); // initialData 추가하여 데이터 로딩 완료 시점에 반영되도록 함

  return (
    <div className="relative">
      <QuizConfigModal 
        isOpen={isQuizModalOpen} 
        onClose={() => setIsQuizModalOpen(false)}
        courseId={courseId}
        currentNoteId={noteId}
        onGenerated={(res) => setQuizResult(res)}
      />

      {quizResult && (
        <CBTPlayer 
          quizData={quizResult} 
          onClose={() => setQuizResult(null)} 
        />
      )}

      <div className="absolute -top-10 right-0 flex items-center gap-1.5 px-3 py-1 bg-white/50 backdrop-blur rounded-full border border-slate-100 z-10 shadow-sm">
        <button 
          onClick={() => setIsQuizModalOpen(true)}
          className="flex items-center gap-1.5 hover:bg-blue-50 px-2 py-0.5 rounded-full transition-colors text-blue-600"
        >
          <BrainCircuit size={12} />
          <span className="text-[9px] font-black uppercase tracking-wider">AI 퀴즈 생성</span>
        </button>
        <div className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'saving' ? 'bg-blue-500 animate-pulse' : saveStatus === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} />
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'error' ? 'Error' : 'Synced'}
        </span>
      </div>

      <section className="relative min-h-[850px] bg-white rounded-[2.5rem] px-12 py-8 shadow-2xl shadow-slate-200/40 border border-slate-100 ring-1 ring-slate-50">
        <style>{`
          .uninote-editor { color: #1e293b; }
          .ProseMirror h1:first-child { 
            font-size: 2.25rem; 
            font-weight: 800; 
            margin-top: 0; 
            margin-bottom: 1rem; 
            border-bottom: 2px solid #f1f5f9;
            padding-bottom: 1rem;
            letter-spacing: -0.025em;
          }
          .uninote-editor h1 { font-size: 2.5rem; font-weight: 800; margin-top: 1.5rem; margin-bottom: 1rem; line-height: 1.2; color: #0f172a; }
          .uninote-editor h2 { font-size: 1.875rem; font-weight: 700; margin-top: 1.25rem; margin-bottom: 0.75rem; color: #1e293b; }
          .uninote-editor p { margin-bottom: 0.75rem; line-height: 1.75; }
          .uninote-editor blockquote { border-left: 4px solid #e2e8f0; padding-left: 1rem; font-style: italic; color: #475569; margin: 1.5rem 0; }
          .uninote-editor img { max-width: 650px; width: 100%; height: auto; border-radius: 12px; margin: 1.5rem 0; border: 1px solid #f1f5f9; display: block; }
          /* 페이지 링크 블록 스타일 고도화 */
          .page-link-wrapper {
            margin: 0.5rem 0;
            padding: 2px 0;
          }
          .page-link-container {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem 1.25rem;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            user-select: none;
            width: fit-content;
            min-width: 280px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          }
          .page-link-container:hover {
            background: #f1f5f9;
            border-color: #cbd5e1;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            transform: translateY(-1px);
          }
          .page-link-icon { font-size: 1.25rem; }
          .page-link-title-text { 
            font-size: 0.95rem; 
            font-weight: 700; 
            color: #334155;
            border-bottom: 1px solid transparent;
          }
          .page-link-container:hover .page-link-title-text {
            border-bottom-color: #94a3b8;
          }

          /* 노션 스타일 코드 블록 */
          .ProseMirror pre { background: #f6f6f7; padding: 14px 16px; border-radius: 8px; margin: 12px 0; overflow-x: auto; border: 1px solid #e2e8f0; }
          .ProseMirror pre code { font-family: 'Fira Code', monospace; background: transparent; padding: 0; color: #1e293b; font-size: 0.9rem; }
          .ProseMirror code { background: rgba(135,131,120,0.15); padding: 2px 4px; border-radius: 4px; font-family: 'Fira Code', monospace; font-size: 0.85em; }
          .uninote-editor ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
          .uninote-editor ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1rem; }
          .uninote-editor [data-type="taskList"] { list-style: none; padding: 0; }
          .uninote-editor [data-type="taskItem"] { display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.25rem; }
          .uninote-editor [data-type="taskItem"] input { margin-top: 0.4rem; cursor: pointer; }
          .ProseMirror > * { padding-left: 32px !important; position: relative; transition: background 0.2s; min-height: 1.5em; }
          .ProseMirror > *:hover { background: rgba(55, 53, 47, 0.04); border-radius: 6px; }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
          .no-scrollbar::-webkit-scrollbar { display: none; }
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
