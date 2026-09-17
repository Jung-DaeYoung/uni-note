import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditor, EditorContent, ReactRenderer, ReactNodeViewRenderer } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { all, createLowlight } from 'lowlight'
import BaseImage from '@tiptap/extension-image';
import Heading from '@tiptap/extension-heading';
import Paragraph from '@tiptap/extension-paragraph';
import { splitBlockAs } from '@tiptap/pm/commands';
import tippy from 'tippy.js';
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
  FileText
} from 'lucide-react';

import client from '../../api/client';
import SlashCommand from './extensions/SlashCommand.js';
import BlockId from './extensions/BlockId.js';
import PageLink from './extensions/PageLink.jsx';
import PdfBlock from './extensions/PdfBlock.jsx';
import SuggestionList from './components/SuggestionList.jsx';
import BlockHandle from './components/BlockHandle.jsx';
import CodeBlockComponent from './components/CodeBlockComponent';
import useNoteUploads, { isAllowedFileUrl } from './hooks/useNoteUploads';
import useNoteAutosave from './hooks/useNoteAutosave';
import useSourceBlockScroll from './hooks/useSourceBlockScroll';

import 'highlight.js/styles/atom-one-dark.css'

const lowlight = createLowlight(all)

// 커스텀 코드 블록 확장 정의
const CustomCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent)
  },
})

// 노트 콘텐츠(JSON)에 저장된 src를 그대로 신뢰하지 않고, 렌더링/직렬화 시점에
// 우리 서버가 실제로 서빙하는 경로인지 다시 검증한다(스킴/오리진 조작 방지).
const Image = BaseImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        parseHTML: (element) => {
          const src = element.getAttribute('src');
          return isAllowedFileUrl(src) ? src : null;
        },
        renderHTML: (attributes) => {
          if (!isAllowedFileUrl(attributes.src)) return {};
          return { src: attributes.src };
        },
      },
    };
  },
})

// 첫 번째 블록을 제목으로 강제하는 커스텀 도큐먼트
// (heading 뒤에는 어떤 block이든 올 수 있어, 이 제약 자체는 Enter로 생성되는
//  다음 블록의 타입과는 무관하다)
const CustomDocument = Document.extend({
  content: 'heading block*',
});

// heading에서 Enter 입력 시 다음 블록이 heading이 아닌 paragraph로 생성되도록 처리
// 원인: @tiptap/starter-kit이 Heading을 Paragraph보다 먼저 스키마에 등록해서,
//       ProseMirror의 기본 분할 로직(defaultBlockAt)이 다음 블록의 기본 타입으로
//       heading을 먼저 선택한다(CustomDocument의 첫 heading 제약과는 무관).
// 해결: splitBlockAs의 콜백에서 분할될 새 블록의 타입을 paragraph로 직접 지정한다.
const CustomHeading = Heading.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Enter: () => this.editor.commands.command(({ state, dispatch }) => {
        if (state.selection.$from.parent.type.name !== this.name) return false;
        const splitAsParagraph = splitBlockAs(() => ({ type: state.schema.nodes.paragraph }));
        return splitAsParagraph(state, dispatch);
      }),
    };
  },
});

// paragraph에서 Enter 입력 시 새 블록도 heading이 아닌 paragraph로 생성되도록 처리
// 원인: CustomHeading과 동일하게, ProseMirror의 기본 분할 로직(defaultBlockAt)이
//       스키마 등록 순서상 heading을 다음 블록의 기본 타입으로 먼저 선택한다.
// 해결: splitBlockAs의 콜백에서 분할될 새 블록의 타입을 paragraph로 직접 지정한다.
// 단, listItem/taskItem 내부의 paragraph는 목록 자체의 Enter 동작(항목 분리/해제)을
// 그대로 사용해야 하므로 조상에 listItem/taskItem이 있으면 false를 반환해 위임한다.
const CustomParagraph = Paragraph.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Enter: () => this.editor.commands.command(({ state, dispatch }) => {
        const { $from } = state.selection;
        if ($from.parent.type.name !== this.name) return false;

        for (let d = $from.depth - 1; d >= 0; d -= 1) {
          const ancestorType = $from.node(d).type.name;
          if (ancestorType === 'listItem' || ancestorType === 'taskItem') return false;
        }

        const splitAsParagraph = splitBlockAs(() => ({ type: state.schema.nodes.paragraph }));
        return splitAsParagraph(state, dispatch);
      }),
    };
  },
});

const NotionEditor = ({ courseId, noteId, initialData, onSaved, onSaveStateChange }) => {
  const navigate = useNavigate();

  const { handleImageUpload, handlePdfUpload, uploadStatus, uploadError, clearUploadError } = useNoteUploads();
  const { saveStatus, getInitialContent, handleEditorUpdate, syncEditor, cancelPendingSave, retrySave } = useNoteAutosave({
    noteId,
    initialData,
    onSaved,
  });

  const editor = useEditor({
    extensions: [
      CustomDocument,
      StarterKit.configure({
        document: false,
        heading: false,
        paragraph: false,
        codeBlock: false,
        // TrailingNode 기본값은 문서 스키마(CustomDocument: 'heading block*')의
        // 시작 노드 타입(heading)을 문서 끝에 자동 삽입할 노드로 오판해, 마지막 블록이
        // heading이 아닐 때마다 빈 H1을 계속 추가했다. paragraph로 명시해 방지한다.
        trailingNode: { node: 'paragraph' },
      }),
      CustomHeading.configure({ levels: [1, 2, 3] }),
      CustomParagraph,
      Placeholder.configure({
        placeholder: ({ node, pos }) => {
          if (pos === 0) return '제목을 입력하세요';
          return '오늘의 강의 내용을 기록하세요. "/"를 입력해 명령어를 확인하세요...';
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image,
      CustomCodeBlock.configure({ lowlight }),
      BlockId,
      PageLink,
      PdfBlock,
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
              { 
                title: 'PDF 업로드', 
                icon: <FileText size={18} className="text-red-500" />, 
                description: 'PDF 파일을 문서에 첨부합니다.',
                command: ({ editor, range }) => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.pdf,application/pdf';
                  input.onchange = async () => {
                    if (input.files?.length) {
                      const result = await handlePdfUpload(input.files[0]);
                      if (result) {
                        editor.chain().focus().deleteRange(range).insertContent({
                          type: 'pdfBlock',
                          attrs: { src: result.url, title: result.title }
                        }).run();
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
            // ReactRenderer는 매 onUpdate(render())마다 새 ref 콜백을 생성해 전달하는데,
            // 그로 인해 React가 이전 ref를 잠깐 null로 해제했다가 다시 붙이는 타이밍이 생긴다.
            // 그 사이 Enter가 눌리면 component.ref가 null이라 onKeyDown이 undefined를
            // 반환해 Suggestion이 이를 처리되지 않은 것으로 보고 일반 줄바꿈이 발생했다.
            // 여기서는 identity가 바뀌지 않는 안정적인 ref 콜백을 직접 넘겨 이 문제를 없앤다.
            let suggestionRef = null;
            const setSuggestionRef = (ref) => {
              suggestionRef = ref;
            };
            return {
              onStart: (props) => {
                component = new ReactRenderer(SuggestionList, {
                  props: { ...props, ref: setSuggestionRef },
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
                popup[0].setProps({ getReferenceClientRect: props.clientRect });
              },
              onKeyDown(props) {
                if (props.event.key === 'Escape') {
                  popup[0].hide();
                  return true;
                }
                return suggestionRef?.onKeyDown(props) ?? false;
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
        spellcheck: 'false',
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
          const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });

          if (file.type.startsWith('image/')) {
            handleImageUpload(file).then(url => {
              if (url && coordinates) {
                editor.chain().focus().insertContentAt(coordinates.pos, {
                  type: 'image',
                  attrs: { src: url }
                }).run();
              }
            });
          } else if (file.type === 'application/pdf') {
            handlePdfUpload(file).then(result => {
              if (result && coordinates) {
                editor.chain().focus().insertContentAt(coordinates.pos, {
                  type: 'pdfBlock',
                  attrs: { src: result.url, title: result.title }
                }).run();
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
      handleEditorUpdate(editor);
    },
  });

  // noteId가 바뀔 때 에디터 인스턴스는 유지하되 내용만 초기화해야 할 경우를 위해 남겨둠
  // 단, 부모에서 <NotionEditor key={noteId} />를 사용한다면 이 Effect는 아예 필요 없음
  useEffect(() => {
    if (!editor) return;
    syncEditor(editor);
    return () => cancelPendingSave();
  }, [noteId, editor, initialData, syncEditor, cancelPendingSave]); // initialData 추가하여 데이터 로딩 완료 시점에 반영되도록 함

  // retrySave/editor 참조 자체는 의존성으로 쓰지 않는다: editor 인스턴스가 렌더마다
  // 새 참조로 보일 수 있어 이를 deps에 넣으면 onSaveStateChange 호출 → 부모 setState →
  // 재렌더 → deps 변경으로 이어지는 무한 루프가 발생한다. saveStatus 변경 시에만
  // 부모에 알리고, retry는 ref를 통해 항상 최신 함수를 호출한다.
  const retrySaveRef = useRef(retrySave);
  const editorRef = useRef(editor);
  useEffect(() => {
    retrySaveRef.current = retrySave;
    editorRef.current = editor;
  });

  useEffect(() => {
    onSaveStateChange?.({ status: saveStatus, retry: () => retrySaveRef.current(editorRef.current) });
  }, [saveStatus, onSaveStateChange]);

  useSourceBlockScroll(editor);

  return (
    <div className="relative">
      {uploadStatus === 'uploading' && (
        <div className="absolute -top-10 left-0 flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-500/10 rounded-full border border-blue-100 dark:border-blue-500/30 z-10 shadow-sm">
          <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">업로드 중...</span>
        </div>
      )}
      {uploadStatus === 'error' && uploadError && (
        <div className="absolute -top-10 left-0 flex items-center gap-1.5 px-3 py-1 bg-red-50 dark:bg-red-500/10 rounded-full border border-red-100 dark:border-red-500/20 z-10 shadow-sm">
          <span className="text-[9px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider">{uploadError}</span>
          <button
            onClick={clearUploadError}
            className="text-[9px] font-black text-red-400 dark:text-red-400/70 hover:text-red-600 dark:hover:text-red-300 uppercase tracking-wider"
          >
            닫기
          </button>
        </div>
      )}

      <section className="relative min-h-[850px] bg-white dark:bg-slate-900 rounded-[2.5rem] px-12 py-8 shadow-2xl shadow-slate-200/40 dark:shadow-slate-950/40 border border-slate-100 dark:border-slate-700 ring-1 ring-slate-50 dark:ring-slate-800">
        <style>{`
          .uninote-editor { color: #1e293b; font-size: 0.9375rem; }
          .ProseMirror h1:first-child { 
            font-size: 1.875rem; 
            font-weight: 800; 
            margin-top: 0; 
            margin-bottom: 1rem; 
            border-bottom: 2px solid #f1f5f9;
            padding-bottom: 1rem;
            letter-spacing: -0.025em;
          }
          .uninote-editor h1 { font-size: 2rem; font-weight: 800; margin-top: 1.5rem; margin-bottom: 1rem; line-height: 1.2; color: #0f172a; }
          .uninote-editor h2 { font-size: 1.5rem; font-weight: 700; margin-top: 1.25rem; margin-bottom: 0.75rem; color: #1e293b; }
          .uninote-editor p { margin-bottom: 0.5rem; line-height: 1.625; }
          .uninote-editor blockquote { border-left: 4px solid #e2e8f0; padding-left: 1rem; font-style: italic; color: #475569; margin: 1.5rem 0; }
          .uninote-editor img { max-width: 650px; width: 100%; height: auto; border-radius: 12px; margin: 1.5rem 0; border: 1px solid #f1f5f9; display: block; }
          
          /* 하이라이트 애니메이션 */
          @keyframes highlight-fade {
            0% { background-color: rgba(59, 130, 246, 0); }
            20% { background-color: rgba(59, 130, 246, 0.2); }
            50% { background-color: rgba(59, 130, 246, 0.3); }
            100% { background-color: rgba(59, 130, 246, 0); }
          }
          .origin-highlight {
            animation: highlight-fade 3s ease-in-out;
            border-radius: 8px;
            position: relative;
          }
          .origin-highlight::before {
            content: '';
            position: absolute;
            left: -12px;
            top: 0;
            bottom: 0;
            width: 4px;
            background: #2563eb;
            border-radius: 2px;
            animation: fade-in 0.5s ease-out;
          }
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

          /* PDF 블록 스타일 */
          .pdf-block-wrapper {
            margin: 1rem 0;
            padding: 2px 0;
          }

          /* 노션 스타일 코드 블록 */
          .code-block-wrapper { margin: 1.5rem 0; position: relative; z-index: 10; }
          .code-block-wrapper pre { background: #f1f5f9; padding: 2.5rem 1rem 1rem; border-radius: 12px; overflow-x: auto; border: 1px solid #e2e8f0; position: relative; }
          .code-block-wrapper pre code { font-family: 'Fira Code', monospace; background: transparent; padding: 0; font-size: 0.9rem; color: #334155; }
          .ProseMirror code { background: rgba(135,131,120,0.12); padding: 2px 4px; border-radius: 4px; font-family: 'Fira Code', monospace; font-size: 0.85em; }
          .uninote-editor ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
          .uninote-editor ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1rem; }
          .uninote-editor [data-type="taskList"] { list-style: none; padding: 0; }
          .uninote-editor li[data-checked] { display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.25rem; }
          .uninote-editor li[data-checked] input { margin-top: 0.4rem; cursor: pointer; }
          .ProseMirror > * { padding-left: 32px !important; position: relative; transition: background 0.2s; min-height: 1.5em; }
          .ProseMirror > *:hover { background: rgba(55, 53, 47, 0.04); border-radius: 6px; }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
          .no-scrollbar::-webkit-scrollbar { display: none; }

          /* 야간모드: 위 규칙은 그대로 두고 .dark 조상이 있을 때만 덮어쓴다 */
          .dark .uninote-editor { color: #cbd5e1; }
          .dark .ProseMirror h1:first-child { border-bottom-color: #334155; }
          .dark .uninote-editor h1 { color: #f1f5f9; }
          .dark .uninote-editor h2 { color: #e2e8f0; }
          .dark .uninote-editor blockquote { border-left-color: #475569; color: #94a3b8; }
          .dark .uninote-editor img { border-color: #334155; }
          .dark .page-link-container { background: #1e293b; border-color: #334155; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
          .dark .page-link-container:hover { background: #273449; border-color: #475569; }
          .dark .page-link-title-text { color: #cbd5e1; }
          .dark .page-link-container:hover .page-link-title-text { border-bottom-color: #64748b; }
          .dark .code-block-wrapper pre { background: #0f172a; border-color: #334155; }
          .dark .code-block-wrapper pre code { color: #cbd5e1; }
          .dark .ProseMirror code { background: rgba(148, 163, 184, 0.16); }
          .dark .ProseMirror > *:hover { background: rgba(148, 163, 184, 0.08); }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
        `}</style>
        <div className="relative z-20">
          {editor && <BlockHandle editor={editor} />}
          <EditorContent editor={editor} />
        </div>
        <div className="absolute top-0 left-12 w-[1px] h-full bg-red-50/50 dark:bg-red-500/10" />
        <div className="absolute top-10 right-10 opacity-5">
          <PenLine size={120} className="text-slate-900 dark:text-slate-100" />
        </div>
      </section>
    </div>
  );
};

export default NotionEditor;
