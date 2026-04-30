import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import debounce from 'lodash.debounce';
import { PenLine } from 'lucide-react';

import client from '../../api/client';
import SlashCommand from './extensions/SlashCommand.js';
import BlockId from './extensions/BlockId.js';
import SuggestionList from './components/SuggestionList.jsx';
import BlockHandle from './components/BlockHandle.jsx';

const NotionEditor = ({ courseId }) => { 
  const [saveStatus, setSaveStatus] = useState('synced');
  const lastSavedJson = useRef(null);
  const isInitialMount = useRef(true);

  // 서버 저장 로직 (JSON 구조 그대로 전송)
  const debouncedSaveToServer = useCallback(
    debounce(async (jsonContent, id) => {
      if (JSON.stringify(jsonContent) === JSON.stringify(lastSavedJson.current)) return;

      setSaveStatus('saving');
      try {
        // API 스펙에 맞춰 JSON 객체 그대로 전송 (백엔드에서 String content로 받을 경우 JSON.stringify 필요)
        await client.post(`/notes/${id}`, { content: JSON.stringify(jsonContent) });
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
      StarterKit,
      Placeholder.configure({
        placeholder: '오늘의 강의 내용을 기록하세요. "/"를 입력해 명령어를 확인하세요...',
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      BlockId,
      SlashCommand.configure({
        suggestion: {
          items: () => [], // 필터링이 필요하다면 여기서 구현
          render: () => {
            let component;
            let popup;

            return {
              onStart: (props) => {
                component = new ReactRenderer(SuggestionList, {
                  props,
                  editor: props.editor,
                });

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
                popup[0].setProps({
                  getReferenceClientRect: props.clientRect,
                });
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
        class: 'prose prose-slate max-w-none focus:outline-none min-h-[700px] text-lg leading-relaxed',
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();

      // 로컬 스토리지 백업
      localStorage.setItem(`note-temp-${courseId}`, JSON.stringify({
        content: json,
        timestamp: Date.now()
      }));

      if (!isInitialMount.current) {
        debouncedSaveToServer(json, courseId);
      }
    },
  });

  // 데이터 로드 및 초기화
  useEffect(() => {
    if (!editor || !courseId) return;

    const loadData = async () => {
      try {
        const res = await client.get(`/notes/${courseId}`);
        const serverData = res.data?.content ? JSON.parse(res.data.content) : null;
        const localDataRaw = localStorage.getItem(`note-temp-${courseId}`);
        const localData = localDataRaw ? JSON.parse(localDataRaw) : null;

        let finalContent = null;
        if (localData && (!serverData || localData.timestamp > (res.data?.updatedAt || 0))) {
          finalContent = localData.content;
        } else {
          finalContent = serverData;
        }

        if (finalContent) {
          editor.commands.setContent(finalContent);
          lastSavedJson.current = finalContent;
        }

        setTimeout(() => {
          isInitialMount.current = false;
        }, 100);

      } catch (error) {
        console.error("데이터 로드 실패:", error);
        isInitialMount.current = false;
      }
    };
    loadData();

    return () => {
      debouncedSaveToServer.cancel();
    };
  }, [editor, courseId, debouncedSaveToServer]);

  return (
    <div className="relative">
      {/* 저장 상태 표시 배지 */}
      <div className="absolute -top-12 right-0 flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full border border-slate-100 z-10 shadow-sm">
        <div className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'saving' ? 'bg-blue-500 animate-pulse' : saveStatus === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} />
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'error' ? 'Error' : 'Synced'}
        </span>
      </div>

      <section className="relative min-h-[850px] bg-white rounded-[2.5rem] p-12 shadow-2xl shadow-slate-200/40 border border-slate-100 ring-1 ring-slate-50">
        <style>{`
          .ProseMirror > * { 
            padding-left: 32px !important; 
            margin-bottom: 0.5em; 
            position: relative; 
            transition: background 0.2s;
          }
          .ProseMirror > *:hover { 
            background: rgba(55, 53, 47, 0.04); 
            border-radius: 6px; 
          }
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


