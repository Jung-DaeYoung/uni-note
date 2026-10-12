# 확인창 개선 구현 계획

## 작업 목표

현재 프론트엔드의 `window.confirm()` 기반 브라우저 확인창 13개를 프로젝트의 Tailwind CSS·다크모드 UI에 맞는 공통 React 확인 모달로 교체한다.

구현은 Claude Code가 담당한다. 기존 기능의 확인/취소 흐름, API 계약, 성공·실패 처리는 유지하고 확인창의 표시 방식만 개선한다.

## 현재 확인창 대상

다음 13개 호출을 모두 교체한다.

| 파일 | 현재 용도 |
|---|---|
| `frontend/src/hooks/useCourseNotes.js` | 노트 삭제, 노트 공유, 공유 후 게시판 이동 |
| `frontend/src/hooks/useCourseBoard.js` | 댓글 삭제, 게시글 삭제 |
| `frontend/src/hooks/useIncorrectNotes.js` | 오답노트 삭제 |
| `frontend/src/hooks/useQuizLibrary.js` | 퀴즈 공유, 퀴즈 삭제, 풀이 기록 삭제 |
| `frontend/src/hooks/useSharedNotes.js` | 공유 노트 게시글 내리기 |
| `frontend/src/hooks/useSharedQuizzes.js` | 공유 시험 게시글 내리기 |
| `frontend/src/pages/CourseDetailPage.jsx` | 강의 삭제 |
| `frontend/src/components/quiz/QuestionComments.jsx` | 댓글 삭제 |

`window.prompt()`와 `alert()`는 이번 작업 대상이 아니다. 확인 모달 교체와 직접 관련 없는 알림 동작은 변경하지 않는다.

## 확정 UX 정책

- 확인창은 공통 `ConfirmProvider`와 `useConfirm` 훅으로 제공한다.
- 호출부는 `await confirm({...})` 형태로 사용하고, 사용자가 취소하면 `false`, 확인하면 `true`를 반환한다.
- 제목과 설명을 분리해 표시한다.
- 긴 설명의 줄바꿈은 유지한다.
- 삭제·공유·이동 동작에 따라 시각적 톤을 구분한다.
  - 삭제/공유 철회: 위험 동작이므로 빨간색 아이콘과 확인 버튼
  - 공유: 파란색 아이콘과 확인 버튼
  - 공유 완료 후 게시판 이동: 초록색 아이콘과 확인 버튼
- 버튼 라벨은 동작을 구체적으로 표시한다. 예: `노트 삭제`, `공유하기`, `게시판으로 이동`.
- 취소 버튼은 항상 제공한다.
- ESC 키는 취소로 처리한다.
- 바깥 배경 클릭은 무시한다. 실수로 파괴적 작업을 취소/확정하지 않도록 한다.
- 우측 상단 닫기 버튼은 취소로 처리한다.
- 모달은 `role="dialog"`, `aria-modal="true"`, 제목 연결용 `aria-labelledby`를 제공한다.
- 기존 다크모드 스타일과 현재 모달 컴포넌트의 둥근 모서리·간격·색상 패턴을 재사용한다.
- 확인 버튼에 자동 포커스를 둘 수 있으나, 키보드 사용자가 ESC로 안전하게 취소할 수 있어야 한다.
- 모달이 열려 있는 동안 요청 Promise가 반드시 한 번만 resolve되도록 처리한다.

## 구현 단계

### 1. 공통 확인 모달 추가

새 파일:

- `frontend/src/context/ConfirmContext.jsx`

구현 내용:

- `ConfirmContext`
- `ConfirmProvider`
- `useConfirm`
- 현재 대기 중인 확인 요청 상태 관리
- `confirm(options)`가 Promise를 반환하도록 구현
- `title`, `message`, `variant`, `confirmLabel`, `cancelLabel` 옵션 지원
- `variant`는 최소 `danger`, `share`, `navigate`를 지원
- 각 variant에 맞는 Lucide 아이콘과 Tailwind 색상 사용
- ESC 및 닫기 버튼으로 `false` 반환
- 확인 버튼으로 `true` 반환
- 중복 resolve 방지
- `useConfirm`가 Provider 외부에서 호출되면 명확한 오류를 발생시킴

모달 컴포넌트를 별도 파일로 분리하는 방식이 더 적절하면 `frontend/src/components/common/ConfirmModal.jsx`로 분리해도 된다. 다만 Provider와 훅의 공개 사용 방식은 일관되게 유지한다.

### 2. 전역 Provider 연결

파일:

- `frontend/src/main.jsx`

`App`이 `ConfirmProvider` 내부에서 렌더링되도록 연결한다. 기존 `ThemeProvider`, `AuthProvider`, `CourseProvider`의 순서와 동작은 보존한다.

권장 구조:

```jsx
<ThemeProvider>
  <ConfirmProvider>
    <AuthProvider>
      <CourseProvider>
        <App />
      </CourseProvider>
    </AuthProvider>
  </ConfirmProvider>
</ThemeProvider>
```

### 3. 확인창 호출부 교체

각 훅/컴포넌트에서 `useConfirm`을 import하고 `const confirm = useConfirm()`을 선언한다. 기존의 동기식 `window.confirm()`을 `await confirm({...})`으로 교체한다.

#### `frontend/src/hooks/useCourseNotes.js`

- 노트 삭제:
  - 제목: `노트를 삭제할까요?`
  - 설명: 대상 노트와 하위 노트가 함께 삭제되며 되돌릴 수 없다는 내용
  - variant: `danger`
  - 확인 라벨: `노트 삭제`
- 노트 공유:
  - 제목: `노트를 공유할까요?`
  - 설명: 현재 내용이 복사되고 이후 수정은 반영되지 않는다는 내용
  - variant: `share`
  - 확인 라벨: `공유하기`
- 공유 완료 후 이동:
  - 제목: `공유가 완료되었습니다`
  - 설명: 노트 공유 게시판으로 이동할지 묻는 내용
  - variant: `navigate`
  - 확인 라벨: `게시판으로 이동`

취소 시 기존처럼 삭제·공유·이동을 중단한다.

#### `frontend/src/hooks/useCourseBoard.js`

- 댓글 삭제:
  - variant: `danger`
  - 확인 라벨: `댓글 삭제`
- 게시글 삭제:
  - variant: `danger`
  - 확인 라벨: `게시글 삭제`

기존 `return` 흐름과 삭제 API 호출을 유지한다.

#### `frontend/src/hooks/useIncorrectNotes.js`

- 오답노트 삭제:
  - 저장된 오답들도 함께 삭제되고 되돌릴 수 없다는 설명
  - variant: `danger`
  - 확인 라벨: `오답노트 삭제`

#### `frontend/src/hooks/useQuizLibrary.js`

- CBT 시험 공유:
  - 같은 강의 수강생이 풀 수 있고 원문은 공개되지 않는다는 설명
  - variant: `share`
  - 확인 라벨: `공유하기`
- 퀴즈 삭제:
  - `shared` 여부에 따른 기존 경고 문구를 보존
  - 제목과 설명을 분리하되, 공유 게시판 글은 유지된다는 중요한 안내를 포함
  - variant: `danger`
  - 확인 라벨: `퀴즈 삭제`
- 풀이 기록 삭제:
  - 오답 통계에서도 제외된다는 설명
  - variant: `danger`
  - 확인 라벨: `기록 삭제`

#### `frontend/src/hooks/useSharedNotes.js`

- 공유 노트 게시글 내리기:
  - 댓글도 함께 삭제된다는 설명
  - variant: `danger`
  - 확인 라벨: `공유 내리기`
- 기존처럼 취소 시 `false`를 반환해야 한다.

#### `frontend/src/hooks/useSharedQuizzes.js`

- 공유 시험 게시글 내리기:
  - 기존 풀이 기록과 오답노트 기록은 유지된다는 설명
  - variant: `danger`
  - 확인 라벨: `공유 내리기`

#### `frontend/src/pages/CourseDetailPage.jsx`

- 강의 삭제:
  - 노트·하위 노트·퀴즈·풀이 기록·오답노트 항목이 영구 삭제된다는 기존 경고를 명확하게 표시
  - variant: `danger`
  - 확인 라벨: `강의 삭제`

#### `frontend/src/components/quiz/QuestionComments.jsx`

- 댓글 삭제:
  - 삭제한 댓글은 복구할 수 없다는 설명
  - variant: `danger`
  - 확인 라벨: `댓글 삭제`

## 코드 품질 및 호환성 조건

- `window.confirm()` 호출이 프론트엔드 실행 소스에 남지 않아야 한다.
- `frontend/src` 내부의 테스트용 `window.alert` 검증은 이번 작업 대상이 아니며, 불필요하게 변경하지 않는다.
- 확인창을 호출하는 함수가 async가 아닌 경우 반드시 `async`로 변경한다.
- Promise를 기다린 뒤 기존 API 호출, 상태 갱신, 반환값이 동일하게 동작해야 한다.
- 삭제·공유 취소 시 API가 호출되지 않아야 한다.
- 기존 오류 처리 `alert()`는 유지한다.
- 기존 사용자 생성 강의·노트·퀴즈 기능 등 확인창과 무관한 코드는 변경하지 않는다.
- 접근성 속성 및 키보드 동작을 확인한다.
- Provider가 모든 확인창 호출 컴포넌트의 상위 트리에 존재해야 한다.

## 검증 계획

Claude Code 구현 후 다음을 실행한다.

```powershell
cd frontend
npm run lint
npm run test
npm run build
```

추가 정적 확인:

```powershell
rg "window\.confirm|confirm\s*\(" frontend/src --glob "*.{js,jsx,ts,tsx}"
```

위 검색 결과에는 새 `useConfirm` 구현의 함수명이나 문서상 설명을 제외하고, 브라우저 `window.confirm()` 직접 호출이 없어야 한다.

## 수동 확인 시나리오

1. 노트·게시글·댓글·오답노트·퀴즈·풀이 기록·강의 삭제 확인창에서 제목, 설명, 버튼 라벨, 위험 색상이 동작별로 올바르게 표시되는지 확인한다.
2. `ESC`, 닫기 버튼, 취소 버튼을 누르면 API가 호출되지 않는지 확인한다.
3. 바깥 배경을 눌러도 모달이 닫히지 않는지 확인한다.
4. 확인 버튼을 누르면 기존 API 호출 및 화면 상태 갱신이 정상인지 확인한다.
5. 노트 공유 완료 후 게시판 이동 확인창에서 취소하면 현재 화면에 남고, 확인하면 `/shared-notes`로 이동하는지 확인한다.
6. 라이트/다크 테마에서 모달의 대비와 버튼 가독성을 확인한다.
7. 긴 노트명·퀴즈명·강의명과 줄바꿈 설명이 레이아웃을 깨뜨리지 않는지 확인한다.

## 완료 기준

- 13개 `window.confirm()` 호출이 공통 React 확인 모달로 교체됨
- 삭제·공유·이동별 시각적 variant 적용
- ESC/닫기/취소가 안전하게 동작
- 기존 API·상태·반환값 동작 보존
- lint, test, build 통과
