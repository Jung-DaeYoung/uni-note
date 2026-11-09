import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditor, EditorContent, ReactRenderer, ReactNodeViewRenderer } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
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
import SourceHighlight from './extensions/SourceHighlight.js';
import SuggestionList from './components/SuggestionList.jsx';
import BlockHandle from './components/BlockHandle.jsx';
import KeywordSelectionMenu from './components/KeywordSelectionMenu.jsx';
import CodeBlockComponent from './components/CodeBlockComponent';
import useNoteUploads, { isAllowedFileUrl, resolveFileUrl } from './hooks/useNoteUploads';
import useNoteAutosave from './hooks/useNoteAutosave';
import useSourceBlockScroll from './hooks/useSourceBlockScroll';
import { showAlert } from '../../context/ConfirmContext';

import 'highlight.js/styles/atom-one-dark.css'
import '../../pages/QuizLibraryPage.css';
import './NotionEditor.css';

// 자주 쓰는 37개 언어만 등록한다(all은 192개로 에디터 번들의 대부분을 차지). 목록에 없는 언어로
// 저장된 블록도 language 속성은 그대로 보존되고, 강조만 없이 표시된다.
const lowlight = createLowlight(common)

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
          const src = resolveFileUrl(attributes.src);
          return src ? { src } : {};
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

// 저장된 노트 JSON을 해석하는 스키마 확장. 편집기와 공유 노트 읽기 전용 뷰어(SharedNoteViewer)가
// 함께 써서 같은 문서가 같은 모양으로 보이게 한다. 편집 전용 확장(Placeholder, SlashCommand)은 뺐다.
// eslint-disable-next-line react-refresh/only-export-components
export const noteSchemaExtensions = [
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
  TaskList,
  TaskItem.configure({ nested: true }),
  Image,
  CustomCodeBlock.configure({ lowlight }),
  BlockId,
  PageLink,
  PdfBlock,
];

// "/" 명령 중 블록 종류만 바꾸는 항목: [제목, 아이콘, 적용할 체인 명령]
const BLOCK_COMMANDS = [
  ['제목 1', <Heading1 size={18} />, (chain) => chain.toggleHeading({ level: 1 })],
  ['제목 2', <Heading2 size={18} />, (chain) => chain.toggleHeading({ level: 2 })],
  ['할 일 목록', <CheckSquare size={18} />, (chain) => chain.toggleTaskList()],
  ['불렛 리스트', <List size={18} />, (chain) => chain.toggleBulletList()],
  ['코드 블록', <Code size={18} />, (chain) => chain.toggleCodeBlock()],
  ['인용구', <Quote size={18} />, (chain) => chain.toggleBlockquote()],
];
const blockCommandItems = BLOCK_COMMANDS.map(([title, icon, apply]) => ({
  title,
  icon,
  command: ({ editor, range }) => apply(editor.chain().focus().deleteRange(range).setParagraph()).run(),
}));

// 파일 선택 창을 열고, 파일을 고르면 onFile로 넘긴다.
const pickFile = (accept, onFile) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.onchange = () => {
    if (input.files?.length) onFile(input.files[0]);
  };
  input.click();
};

// onKeywordSelect를 넘기면 텍스트 선택 시 키워드 메뉴(설명, onKeywordQuiz가 있으면 문제 만들기)를 보여 준다.
// onEditorReady(editor)는 편집기가 만들어지거나 사라질 때(null) 호출된다(키워드 설명 삽입용).
const NotionEditor = ({ courseId, noteId, initialData, onSaved, onSaveStateChange, onKeywordSelect, onKeywordQuiz, onEditorReady }) => {
  const navigate = useNavigate();

  const { handleImageUpload, handlePdfUpload, uploadStatus, uploadError, clearUploadError } = useNoteUploads();
  const { saveStatus, getInitialContent, handleEditorUpdate, syncEditor, cancelPendingSave, retrySave } = useNoteAutosave({
    noteId,
    initialData,
    onSaved,
  });

  const editor = useEditor({
    extensions: [
      ...noteSchemaExtensions,
      SourceHighlight,
      Placeholder.configure({
        placeholder: ({ pos }) => {
          if (pos === 0) return '제목을 입력하세요';
          return '오늘의 강의 내용을 기록하세요. "/"를 입력해 명령어를 확인하세요...';
        },
      }),
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
                  } catch {
                    showAlert("하위 노트 생성에 실패했습니다.");
                  }
                }
              },
              ...blockCommandItems,
              {
                title: '이미지 업로드',
                icon: <ImageIcon size={18} />,
                command: ({ editor, range }) => pickFile('image/*', async (file) => {
                  const url = await handleImageUpload(file);
                  if (url) {
                    editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
                  }
                })
              },
              {
                title: 'PDF 업로드',
                icon: <FileText size={18} className="text-red-500" />,
                description: 'PDF 파일을 문서에 첨부합니다.',
                command: ({ editor, range }) => pickFile('.pdf,application/pdf', async (file) => {
                  const result = await handlePdfUpload(file);
                  if (result) {
                    editor.chain().focus().deleteRange(range).insertContent({
                      type: 'pdfBlock',
                      attrs: { src: result.url, title: result.title }
                    }).run();
                  }
                })
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
    content: getInitialContent(),
    editorProps: {
      attributes: {
        class: 'uninote-editor focus:outline-none min-h-[50vh] md:min-h-[700px] text-lg leading-relaxed',
        spellcheck: 'false',
      },
      handleClickOn: (view, pos, node) => {
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

  // 최초 1회 에디터 내용을 서버/로컬 데이터와 맞추고 자동 저장 기준점을 잡는다(useNoteAutosave.syncEditor).
  useEffect(() => {
    if (!editor) return;
    syncEditor(editor);
    return () => cancelPendingSave();
  }, [noteId, editor, initialData, syncEditor, cancelPendingSave]);

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

  useEffect(() => {
    if (!editor || !onEditorReady) return undefined;
    onEditorReady(editor);
    return () => onEditorReady(null);
  }, [editor, onEditorReady]);

  return (
    <div className="relative">
      {/* 업로드 상태. 위치를 고정해 본문이 밀리지 않게 하고, 화면 낭독기에도 알린다. */}
      <div role="status" className="ne-status">
        {uploadStatus === 'uploading' && <span>업로드 중...</span>}
        {uploadStatus === 'error' && uploadError && (
          <>
            <span className="ne-status-error">{uploadError}</span>
            <button onClick={clearUploadError} className="ne-status-close">닫기</button>
          </>
        )}
      </div>

      <section className="relative min-h-[60vh] md:min-h-[850px] bg-white dark:bg-slate-900 rounded px-4 py-6 md:px-12 md:py-8 border border-slate-200 dark:border-slate-700">
        <div className="relative z-20">
          {editor && <BlockHandle editor={editor} />}
          {editor && onKeywordSelect && <KeywordSelectionMenu editor={editor} onExplain={onKeywordSelect} onQuiz={onKeywordQuiz} />}
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
