# 🎓 UniNote 코드 과외 — 5강: Slash Command (/) 메뉴 및 커스텀 에디터 확장 블록

---

## 1. 이 기능이 무엇인가?

노션(Notion)에서 본문 빈 줄에 **슬래시(`/`)를 입력하면 플로팅 팝업 메뉴가 나타나 키보드(↑/↓, Enter, Esc)로 원하는 블록(제목, 코드 블록, 체크리스트, 하위 노트 링크 등)을 즉시 생성**하고, 각 블록마다 고유 ID(`BlockId`)를 부여해 향후 **AI 문제 출처 추적**까지 가능하게 만드는 에디터 확장 기능입니다.

---

## 2. 왜 필요한가?

1. **마우스 없는 몰입형 타이핑 경험 (UX)**: 상단 툴바를 누르러 매번 마우스를 쥐지 않고, 키보드에서 손을 떼지 않은 채 `/h1`, `/code`, `/todo`처럼 빠르게 문서를 구조화할 수 있습니다.
2. **문서 간 연결 (Page Link)**: 노션처럼 노트 안에 자식 노트를 생성하고 링크 블록을 심어 계층적 지식 그래프를 구성할 수 있습니다.
3. **AI 퀴즈 출처 추적 (Source Tracking)**: AI가 노트를 기반으로 문제를 냈을 때, "이 퀴즈가 노트의 몇 번째 어떤 문단에서 나왔는가?"를 특정하려면 **모든 텍스트 문단(블록)마다 고유한 주민등록번호(`data-id`)**가 매겨져 있어야 합니다.

---

## 3. 전체 동작 흐름

```
1. 사용자가 에디터 빈 줄에서 "/" 키 입력
  ↓
2. Tiptap의 Suggestion 플러그인이 "/" 감지 (SlashCommand.js)
  ↓
3. Tippy.js 라이브러리가 커서 바로 아래 좌표(clientRect)에 플로팅 팝업 생성
  ↓
4. SuggestionList.jsx 렌더링:
   - 검색어 필터링 (예: "/제" 입력 시 "제목 1", "제목 2"만 필터)
   - 키보드 위/아래(ArrowUp/Down) 이동 및 스크롤 동기화
  ↓
5. 사용자가 "하위 노트 추가" 선택 후 Enter 클릭 (또는 마우스 클릭)
  ↓
6. 커맨드 콜백 실행:
   - 백엔드에 POST /api/courses/{courseId}/notes?parentNoteId={noteId} 호출 (하위 노트 DB 생성)
   - 에디터에서 방금 입력한 "/" 문자 범위(range) 삭제
   - 그 자리에 커스텀 atom 블록인 <pageLink noteId="..." title="..." /> 삽입
  ↓
7. 동시에 모든 블록에 BlockId 확장이 작동하여 고유 ID(data-id="a8f9c2d1") 자동 부여
  ↓
8. 팝업 닫힘 (Tippy.js destroy 및 정리)
```

---

## 4. 실제 코드 위치

**Frontend (에디터 코어 & 확장):**
- `frontend/src/components/editor/extensions/SlashCommand.js` — `/` 트리거 감지, 우선순위(`priority: 1000`), 커맨드 실행 래퍼
- `frontend/src/components/editor/components/SuggestionList.jsx` — 키보드 화살표 네비게이션, 스크롤 보정, 마우스 포커스 보호 UI
- `frontend/src/components/editor/extensions/BlockId.js` — 모든 문단(paragraph, heading 등)에 8자리 임의 고유 ID 부여
- `frontend/src/components/editor/extensions/PageLink.jsx` — 하위 노트를 가리키는 커스텀 Atom 블록 및 최신 제목 실시간 동기화
- `frontend/src/components/editor/NotionEditor.jsx` — Tippy.js 팝업 라이프사이클 관리, 명령어 아이템 목록 정의, 블록 클릭 라우팅

**Database 연계:**
- `notes` 테이블의 `content` 컬럼(JSON) 내부에 `attrs: { id: "...", noteId: ... }` 형태로 영구 저장됨

---

## 5. 코드가 실제로 어떻게 실행되는가?

### 🔵 STEP 1. Tiptap Suggestion과 이벤트 우선순위 (`priority: 1000`)

슬래시 커맨드는 Tiptap 코어의 `Extension`과 `@tiptap/suggestion` 유틸리티를 조합하여 만듭니다.

`SlashCommand.js`:

```javascript
import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';

export default Extension.create({
  name: 'slashCommand',

  // ⚠️ 매우 중요: CustomHeading/CustomParagraph의 Enter 키맵보다
  // Suggestion의 Enter 처리가 먼저 실행되도록 우선순위를 1000으로 대폭 올린다!
  priority: 1000,

  addOptions() {
    return {
      suggestion: {
        char: '/', // 감지할 트리거 문자
        command: ({ editor, range, props }) => {
          // 사용자가 목록에서 아이템을 골랐을 때 실행되는 커맨드
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
```

> **왜 `priority: 1000`이 필요한가요?**  
> Tiptap에서는 각 블록(제목, 본문)마다 Enter 키를 눌렀을 때 다음 줄로 넘기는 기본 키맵이 등록되어 있습니다. 만약 우선순위(`priority`)를 높이지 않으면, 슬래시 메뉴가 열려 있어도 Enter를 쳤을 때 **메뉴 아이템이 선택되는 대신 그냥 줄바꿈이 일어나는 버그**가 생깁니다. 이를 해결하기 위해 슬래시 커맨드의 우선순위를 최상위로 끌어올린 것입니다.

> 💬 **쉽게 말하면**: "메뉴창이 열려 있을 때는 줄바꿈 하지 말고 내가 고른 메뉴를 먼저 실행해줘!"라고 새치기 권한을 주는 것입니다.

---

### 🔵 STEP 2. Tippy.js를 통한 커서 위치 팝업 렌더링

`NotionEditor.jsx`:

```javascript
render: () => {
  let component;
  let popup;
  let suggestionRef = null;

  return {
    // 사용자가 "/"를 타이핑한 순간 실행
    onStart: (props) => {
      // 1. React 컴포넌트(SuggestionList)를 Tiptap DOM 렌더러로 감싸기
      component = new ReactRenderer(SuggestionList, {
        props: { ...props, ref: (ref) => { suggestionRef = ref; } },
        editor: props.editor,
      });

      // 2. Tippy.js를 사용해 글자 커서 바로 밑에 팝업 띄우기
      popup = tippy('body', {
        getReferenceClientRect: props.clientRect, // 커서의 화면상 (X, Y) 좌표
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
      });
    },

    // 사용자가 검색어를 더 입력할 때마다 위치 및 목록 갱신
    onUpdate(props) {
      component.updateProps(props);
      popup[0].setProps({ getReferenceClientRect: props.clientRect });
    },

    // 키보드 이벤트 중계
    onKeyDown(props) {
      if (props.event.key === 'Escape') {
        popup[0].hide();
        return true;
      }
      return suggestionRef?.onKeyDown(props) ?? false;
    },

    // 메뉴가 닫힐 때 메모리 누수 방지
    onExit() {
      popup?.[0]?.destroy();
      component?.destroy();
    },
  };
}
```

> 💬 **쉽게 말하면**: Tiptap은 텍스트 편집기일 뿐 팝업을 띄우는 재주가 없습니다. 그래서 화면 좌표를 재는 전문 라이브러리 `Tippy.js`를 빌려와 커서가 깜빡이는 바로 그 자리에 React 메뉴창을 정확히 띄우고 닫습니다.

---

### 🔵 STEP 3. 부드러운 키보드 네비게이션과 포커스 보호 (`SuggestionList.jsx`)

키보드 화살표로 메뉴를 위아래로 이동하고, 마우스로 메뉴를 클릭할 때 에디터의 커서가 풀리지 않도록 섬세하게 제어합니다.

`SuggestionList.jsx`:

```jsx
useImperativeHandle(ref, () => ({
  onKeyDown: ({ event }) => {
    if (event.key === 'ArrowUp') {
      setSelectedIndex((prev) => (prev + items.length - 1) % items.length); // 위로 순환
      return true;
    }
    if (event.key === 'ArrowDown') {
      setSelectedIndex((prev) => (prev + 1) % items.length); // 아래로 순환
      return true;
    }
    if (event.key === 'Enter') {
      selectItem(selectedIndex); // 선택 실행
      return true;
    }
    return false;
  },
}));

// 메뉴를 클릭할 때 에디터의 포커스를 뺏기지 않도록 기본 동작 차단!
<div onMouseDown={(e) => e.preventDefault()}>
  {items.map((item, index) => (
    <button
      key={index}
      onMouseDown={(e) => {
        e.preventDefault(); // 에디터 blur 방지
        selectItem(index);
      }}
      ...
    >
```

> 💬 **쉽게 말하면**: 메뉴 버튼을 마우스로 '딸깍' 누르는 순간 웹 브라우저는 에디터의 커서를 없애버리려고 합니다. `e.preventDefault()`를 걸어두어 사용자가 메뉴를 클릭해도 에디터의 타이핑 상태가 그대로 유지되도록 만듭니다.

---

### 🔵 STEP 4. 슬래시 커맨드의 실제 동작: "하위 노트 생성"

슬래시 메뉴에서 지원하는 기능 중 가장 강력한 것은 **"현재 문서 밑에 새 자식 노트를 만들고 본문에 링크를 거는 커맨드"**입니다.

`NotionEditor.jsx`:

```javascript
{
  title: '하위 노트 추가',
  icon: <FilePlus size={18} className="text-blue-500" />,
  description: '현재 노트 아래에 새 페이지를 만듭니다.',
  command: async ({ editor, range }) => {
    try {
      // 1. 서버에 부모 노트 ID를 지정하여 새 하위 노트 생성 요청
      const res = await client.post(`/courses/${courseId}/notes?parentNoteId=${noteId}`);
      
      // 2. 에디터에서 방금 입력한 "/" 문자 삭제 후 그 자리에 PageLink 블록 삽입!
      editor.chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: 'pageLink',
          attrs: {
            noteId: res.data.noteId,
            title: res.data.title, // "제목 없음"
          }
        })
        .run();
    } catch {
      alert("하위 노트 생성에 실패했습니다.");
    }
  }
}
```

> 💬 **쉽게 말하면**: `/하위`를 입력하고 엔터를 치면, 서버 백엔드에 즉시 자식 노트를 생성(`POST /notes`)하고, 에디터 본문에는 그 자식 노트로 워프할 수 있는 예쁜 링크 블록(`<pageLink />`)을 쏙 집어넣어 줍니다.

---

### 🔵 STEP 5. 최신 제목을 실시간 반영하는 `PageLink` 확장 블록

링크 블록을 만들었는데, 나중에 그 자식 노트의 제목을 바꾸면 본문 속 링크 이름도 바뀌어야 할까요? 당연합니다!

`PageLink.jsx`:

```jsx
const PageLinkComponent = ({ node }) => {
  const { noteId, title: attrsTitle } = node.attrs;
  const { findTitle } = useNoteTree(); // 3강에서 배운 전역 NoteTreeContext!
  
  // 트리의 최신 제목을 실시간 검색! 없으면 블록에 저장된 옛날 제목 사용
  const currentTitle = findTitle(noteId) || attrsTitle;

  return (
    <NodeViewWrapper className="page-link-wrapper" data-type="page-link">
      <div className="page-link-container">
        <span className="page-link-icon">📄</span>
        <span className="page-link-title-text">{currentTitle || '제목 없음'}</span>
      </div>
    </NodeViewWrapper>
  );
};
```

> 💬 **쉽게 말하면**: 자식 노트를 수정해서 제목을 `제목 없음` → `1주차 알고리즘 과제`로 바꿨을 때, 부모 노트 본문에 박혀 있는 링크도 `NoteTreeContext`를 통해 실시간으로 최신 제목으로 동기화되어 표시됩니다.

---

### 🔵 STEP 6. 문제 출처 추적을 위한 `BlockId` 확장

UniNote의 8강(AI 퀴즈 생성)을 가능하게 해주는 숨은 일등 공신입니다.

`BlockId.js`:

```javascript
export default Extension.create({
  name: 'blockId',

  addGlobalAttributes() {
    return [
      {
        // 문단, 제목, 인용구, 코드블록 등 모든 블록 노드에 id 속성 부여
        types: ['paragraph', 'heading', 'blockquote', 'codeBlock', 'taskList'],
        attributes: {
          id: {
            default: null,
            parseHTML: element => element.getAttribute('data-id'),
            renderHTML: attributes => {
              // ID가 아직 없다면 8자리 고유 문자열 자동 생성
              if (!attributes.id) {
                attributes.id = Math.random().toString(36).substring(2, 10);
              }
              return { 'data-id': attributes.id };
            },
            keepOnSplit: false, // 줄바꿈(Enter) 시 새 줄에는 새 ID 부여!
          },
        },
      },
    ];
  },
});
```

> **HTML 결과물 예시:**
> ```html
> <p data-id="k9x2m4p1">운영체제에서 프로세스와 스레드의 차이는...</p>
> <p data-id="q7w8e9r0">가상 메모리는 페이징 기법을 사용하여...</p>
> ```

> 💬 **쉽게 말하면**: 사용자가 타이핑하는 모든 문단마다 눈에 보이지 않는 고유 시리얼 넘버(`data-id`)를 붙여둡니다. 나중에 AI가 문제를 만들 때 "이 문제는 `k9x2m4p1` 문단에서 냈다!"라고 출처를 기록하고, 학생이 오답노트에서 클릭하면 해당 문단으로 자동 스크롤해 줄 수 있습니다.

---

## 6. 데이터가 어떻게 이동하는가?

```
[사용자 입력: "/"]
       ↓
[Tiptap SlashCommand 플러그인]
       ↓ (커서 좌표 계산)
[Tippy.js 팝업 컨테이너 생성]
       ↓
[SuggestionList (React UI)]
   - 화살표 키 (selectedIndex 변경)
   - Enter 입력 → selectItem()
       ↓
[command 콜백 실행: '하위 노트 추가']
       ├── 1. Axios: POST /api/courses/1/notes?parentNoteId=10 ──→ 백엔드 DB 저장
       │
       └── 2. editor.chain().deleteRange().insertContent()
                 ↓
           [PageLink Block] 본문에 삽입됨:
           {
             type: "pageLink",
             attrs: { noteId: 105, title: "제목 없음" }
           }
                 ↓
[BlockId Extension]
   - 본문의 모든 블록에 { id: "a8b9c1d2" } 속성 부여
                 ↓
[4강의 useNoteAutosave 실행]
   - JSON 형태로 백엔드 notes.content에 통째로 영구 저장!
```

---

## 7. 왜 이렇게 설계했는가?

1. **왜 `priority: 1000`으로 커스텀 확장 우선순위를 지정했는가?**
   - Tiptap의 내부 엔진인 ProseMirror는 플러그인 등록 순서대로 이벤트를 소비합니다.
   - 일반 문단이나 제목 블록도 `Enter` 키에 대한 기본 핸들러를 가지고 있으므로, 우선순위를 높여주지 않으면 메뉴가 열려 있어도 Suggestion의 키 처리가 무시당하기 때문입니다.

2. **왜 `Element.scrollIntoView()` 대신 직접 `scrollTop`을 계산했는가?**
   - 브라우저의 기본 `scrollIntoView()` 함수는 호출될 때 네이티브 selection(텍스트 선택 영역)을 미세하게 건드립니다.
   - ProseMirror는 이를 "사용자가 마우스로 다른 곳을 클릭했다"고 오해하여 메뉴를 강제로 닫아버리는(`onExit`) 치명적인 부수효과가 있었습니다. 따라서 컨테이너의 스크롤 높이(`scrollTop`)를 수학적으로 직접 계산해 이동시켰습니다.

3. **왜 `keepOnSplit: false`인가?**
   - 사용자가 문단 중간에서 `Enter`를 쳐서 두 줄로 쪼갤 때(`Split`), `keepOnSplit: true`로 두면 두 문단이 **동일한 `data-id`**를 갖게 됩니다.
   - 두 문단의 ID가 같아지면 AI 문제 출처를 특정할 때 고유성이 깨지므로, 새로 생긴 줄에는 반드시 새로운 난수 ID가 발급되도록 `false`로 설정했습니다.

---

## 8. 초보자가 헷갈리기 쉬운 부분

| 헷갈리는 것 | 실제 동작 |
|---|---|
| 슬래시 커맨드는 별도 모달창인가요? | 모달이 아니라 에디터 커서의 **절대 좌표(ClientRect)**를 계산해 마우스 툴팁처럼 띄우는 **플로팅(Floating) 팝업**입니다. |
| `PageLink` 블록 안에 글자를 더 타이핑할 수 있나요? | **불가능합니다.** `atom: true`로 설정된 블록은 원자(Atom)처럼 취급되어, 내부 텍스트를 편집할 수 없고 하나의 단일 UI 컴포넌트처럼 통째로 선택/삭제/드래그만 가능합니다. |
| `onMouseDown={(e) => e.preventDefault()}`는 왜 하나요? | 버튼을 누를 때 브라우저 기본 동작으로 인해 에디터 본문의 포커스가 해제(blur)되어 커서가 사라지는 현상을 방지합니다. |
| `BlockId`는 DB의 PK인가요? | 아닙니다. DB 테이블의 기본키(ID)가 아니라, **Tiptap JSON 문서 내부의 각 문단을 구별하기 위한 프론트엔드/AI용 클라이언트 식별자**입니다. |

---

## 9. 시험/면접에서 알아야 할 핵심

> **"리치 텍스트 에디터(Tiptap/ProseMirror)에서 슬래시(/) 명령어와 커스텀 블록을 확장할 때 겪었던 기술적 난관과 해결 방법을 말씀해 주세요."**

✅ 이렇게 설명할 수 있습니다:
> "크게 두 가지 난관이 있었습니다.  
> 첫째는 **키보드 이벤트 충돌**이었습니다. 에디터의 기본 블록들이 가진 Enter 키맵이 Suggestion 플러그인보다 먼저 이벤트를 가로채서, 팝업이 떠 있어도 메뉴 선택이 되지 않는 문제가 있었습니다. 이를 해결하기 위해 확장 설정에서 `priority: 1000`을 부여하여 팝업이 활성화되었을 때는 Suggestion의 키 핸들러가 최우선으로 실행되도록 설계했습니다.  
> 둘째는 **포커스 이탈 및 자동 스크롤 버그**였습니다. 메뉴를 클릭할 때 에디터 포커스가 풀리는 문제는 `onMouseDown`의 `preventDefault()`로 방어했고, 키보드로 메뉴를 탐색할 때 `scrollIntoView()`가 브라우저 selection을 건드려 팝업이 강제 종료되던 문제는 부모 컨테이너의 `scrollTop`을 직접 계산하는 방식으로 리팩터링하여 완벽한 키보드 인터랙션을 구현했습니다."

---

## 10. 이해 확인 문제 📝

**Q1. (쉬운 문제)**  
에디터 본문에서 슬래시 메뉴를 화면에 띄우기 위해 키보드로 입력해야 하는 트리거 문자는 무엇인가요?

**Q2. (흐름 문제)**  
사용자가 슬래시 메뉴에서 "하위 노트 추가"를 선택했을 때, 서버 통신과 에디터 본문에는 각각 어떤 동작이 일어나나요?

**Q3. (코드 이해)**  
`SlashCommand.js`에서 `priority: 1000`을 지정하지 않으면 어떤 버그가 발생하나요?

**Q4. (설계 이해)**  
`BlockId.js`에서 `attributes.id`의 `keepOnSplit` 속성을 `false`로 지정한 이유는 무엇인가요?

**Q5. (면접형)**  
자식 노트의 제목이 변경되었을 때, 부모 노트 본문에 삽입된 `PageLink` 컴포넌트가 옛날 제목에 머무르지 않고 최신 제목을 실시간으로 렌더링할 수 있는 비결은 무엇인가요?
