# 현재 작업 계획: Tiptap Slash Command 단계적 단순화

## 작업 목표

`PLANS.md`의 기준에 따라 UniNote Slash Command 구조를 기능 변경 없이 단계적으로 단순화한다.

- Notion과 유사한 Slash Command UX를 유지한다.
- Tiptap `Suggestion`의 기본 매칭과 키보드 이벤트 흐름을 최대한 사용한다.
- 초보자가 이해하기 쉬운 구조를 유지한다.
- 새로운 추상화, 공통 레이어, 라이브러리는 추가하지 않는다.
- workaround는 한 번에 하나만 제거하고, 각 변경 후 테스트한다.

## 현재 단계

### 0단계: 기준 동작 확인

아직 코드를 수정하지 않는다. 현재 작업 트리와 기존 기능을 기준선으로 기록한 뒤 1단계로 진행한다.

## 작업 범위

### 분석 대상

- `frontend/src/components/editor/extensions/SlashCommand.js`
- `frontend/src/components/editor/NotionEditor.jsx`
- `frontend/src/components/editor/components/SuggestionList.jsx`

### 관련 기능

- `/` 입력과 메뉴 표시
- 검색어 필터링
- ArrowUp/ArrowDown 선택
- Enter 명령 실행
- 마우스 클릭 명령 실행
- Escape 메뉴 닫기
- 메뉴 종료 후 일반 Enter
- 이미지/PDF 업로드
- 하위 노트 생성
- 자동 저장과 localStorage 복구
- 기존 노트와 블록 기능

## 현재 구조 요약

```text
NotionEditor
 └─ SlashCommand
     └─ Tiptap Suggestion
         ├─ findSuggestionMatchWithFallback()
         ├─ renderer.onStart/onUpdate/onExit/onKeyDown
         └─ SuggestionList
```

현재 Enter에는 Tiptap 기본 흐름 외에 별도 우회가 있다.

```text
SlashCommand.addKeyboardShortcuts()
 └─ storage.pendingEnterHandler
     └─ NotionEditor의 suggestion ref
         └─ SuggestionList.onKeyDown()
```

### 주요 제거 후보

- 디버깅 목적 `console.log`
- `addStorage().pendingEnterHandler`
- `addKeyboardShortcuts().Enter`
- `NotionEditor.jsx`의 `lastKnownSuggestionRef`
- `findSuggestionMatchWithFallback()`
- 원인 확인 후 더 이상 필요하지 않은 transaction/DOM selection 디버깅 코드

## 현재 구조에서 유지할 계약

- `SuggestionList`의 `props.command(item)` 호출
- `SlashCommand`의 `props.command({ editor, range })` 연결
- 각 명령의 `focus()`와 `deleteRange(range)` 동작
- 이미지/PDF 업로드 API 호출 및 삽입 형식
- 하위 노트 생성 API와 page link 삽입 형식
- Tiptap JSON 저장 형식
- `NotionEditor.onUpdate`와 `useNoteAutosave`의 자동 저장 흐름
- heading/paragraph/list/task list의 기존 Enter 동작
- JWT, API 경로, DB 저장 형식

## 단계별 실행 계획

### 0단계: 기준 동작 기록

**수정 파일**

- 없음

**확인할 내용**

- `/` 입력 시 메뉴가 표시되는지
- 검색어 입력 시 목록이 필터링되는지
- ArrowUp/ArrowDown으로 선택이 이동하는지
- Enter가 현재 선택 명령을 실행하는지
- 마우스 클릭으로 명령이 실행되는지
- Escape로 메뉴가 닫히는지
- 메뉴가 닫힌 후 Enter가 일반 줄바꿈으로 동작하는지
- 이미지/PDF 업로드와 하위 노트 생성이 동작하는지
- localStorage와 서버 자동 저장이 유지되는지
- 기존 노트, heading, paragraph, list, task list 기능이 유지되는지

**기록할 문제**

- Enter가 일반 줄바꿈으로 처리되는지
- renderer `onKeyDown`이 호출되지 않는 경우가 있는지
- 메뉴가 표시된 상태에서 Suggestion이 조기에 종료되는지
- command의 `range`가 slash부터 query 끝까지 정확한지

**다음 단계 조건**

- 기준 동작을 확인하고, 현재 실패가 있는 경우 해당 재현 절차를 기록한다.

### 1단계: `SuggestionList.jsx` 디버깅 로그 제거

**수정 파일**

- `frontend/src/components/editor/components/SuggestionList.jsx`

**변경 내용**

- item 선택 전후 `console.log` 제거
- `onKeyDown` 입력 및 반환값 `console.log` 제거
- 선택, 방향키, Enter, 마우스 `onMouseDown`, 직접 스크롤 로직은 유지

**제거 근거**

- 로그는 UI 상태나 command 실행을 변경하지 않는다.

**테스트**

- 방향키 선택 및 방향키 후 Enter
- 마우스 클릭
- Escape
- 메뉴 내부 스크롤 후 Enter
- 검색 결과가 없는 상태의 Enter

**문제 발생 시 복구**

- 이 단계의 로그만 복구한다.

### 2단계: `SlashCommand.js` command 로그 제거

**수정 파일**

- `frontend/src/components/editor/extensions/SlashCommand.js`

**변경 내용**

- `props.command start/end` 로그 제거
- `props.command({ editor, range })` 계약 유지
- `pendingEnterHandler`와 matcher fallback은 유지

**제거 근거**

- 명령 실행 전후 JSON 출력은 기능에 필요하지 않다.

**테스트**

- 텍스트, 제목, 불렛 리스트, 할 일 목록
- 코드 블록, 인용구
- 이미지/PDF 업로드
- 하위 노트 생성

**문제 발생 시 복구**

- command 로그만 복구한다.

### 3단계: `NotionEditor.jsx` renderer 로그 제거

**수정 파일**

- `frontend/src/components/editor/NotionEditor.jsx`

**변경 내용**

- `onStart`, popup 표시, `onUpdate`, renderer `onKeyDown`, `onExit` 로그 제거
- transaction 상세 로그와 `handleTextInput` DOM selection 로그는 일단 유지
- popup 생성/갱신/정리와 ReactRenderer ref 흐름은 변경하지 않음

**제거 근거**

- renderer 로그는 Suggestion 생명주기와 UI 동작에 필요하지 않다.

**테스트**

- 검색어 입력 중 popup 위치 갱신
- 방향키와 Enter
- Escape 후 popup 제거
- 마우스 클릭
- 이미지/PDF 명령 진입

**문제 발생 시 복구**

- renderer 로그만 복구한다.

### 4단계: 기본 Suggestion Enter 흐름 검증

**수정 파일**

- 없음

**확인할 흐름**

```text
Suggestion.handleKeyDown
 └─ active 확인
     └─ renderer.onKeyDown
         └─ suggestionRef.onKeyDown
             └─ SuggestionList.onKeyDown
```

**확인할 항목**

- `/` 직후 Enter
- 검색어 입력 후 Enter
- ArrowUp/ArrowDown 후 Enter
- `onUpdate` 직후 Enter
- 메뉴 스크롤 후 Enter
- Escape 후 일반 Enter
- Enter가 일반 줄바꿈으로 중복 처리되지 않는지
- Suggestion `active`, `range`, `query`가 입력 위치와 일치하는지

**판단 기준**

- renderer `onKeyDown`이 안정적으로 호출되어야 한다.
- `suggestionRef`가 유효해야 한다.
- Enter 전에 의도하지 않은 `onExit`가 발생하지 않아야 한다.
- command 실행 후 slash와 query가 한 번만 삭제되어야 한다.

**다음 단계 조건**

- 기본 흐름이 안정적이면 `pendingEnterHandler` 제거 단계로 진행한다.
- 문제가 재현되면 원인을 기록하고 우회 코드를 유지한 채 원인만 수정한다.

### 5단계: `pendingEnterHandler` 제거

**수정 파일**

- `frontend/src/components/editor/extensions/SlashCommand.js`
- `frontend/src/components/editor/NotionEditor.jsx`

**변경 내용**

`SlashCommand.js`

- `addStorage()`의 `pendingEnterHandler` 제거
- `addKeyboardShortcuts()`의 custom `Enter` 제거
- 관련 주석 제거

`NotionEditor.jsx`

- `onStart`의 handler 등록 제거
- `onExit`의 handler 정리 제거
- handler 목적의 주석 제거

**제거 근거**

- Tiptap Suggestion 기본 `handleKeyDown`이 active 상태에서 renderer `onKeyDown`을 호출한다.
- `SuggestionList`가 Enter 처리 후 `true`를 반환하므로 별도 Enter keymap이 중복될 수 있다.

**테스트**

- `/` 후 Enter
- 검색어 후 Enter
- ArrowUp/ArrowDown 후 Enter
- 메뉴 이동/스크롤 후 Enter
- 마우스 클릭과 Escape
- 메뉴 종료 후 일반 Enter
- heading, paragraph, list, task list Enter
- 이전 메뉴의 handler가 다음 Enter를 가로채지 않는지

**문제 발생 시 복구**

- `pendingEnterHandler`와 custom Enter keymap만 복구한다.
- matcher fallback은 함께 변경하지 않는다.

### 6단계: `lastKnownSuggestionRef` 제거 검토

**수정 파일**

- `frontend/src/components/editor/NotionEditor.jsx`

**변경 내용**

- `lastKnownSuggestionRef` 제거
- 마지막 ref를 저장하는 `setSuggestionRef` 보완 로직 제거
- stale ref 관련 주석 제거

**제거 근거**

- `pendingEnterHandler` 제거 후 마지막 ref를 별도로 보관할 사용처가 없다.
- 기본 renderer 흐름은 현재 SuggestionList ref로 충분해야 한다.

**테스트**

- `onStart` 직후 Enter
- 검색어 입력 직후 Enter
- ArrowDown 직후 Enter
- `onUpdate` 직후 Enter
- 마우스 클릭, Escape, 일반 Enter

**문제 발생 시 복구**

- `lastKnownSuggestionRef`만 복구한다.
- `pendingEnterHandler`는 다시 추가하지 않는다.

### 7단계: `findSuggestionMatchWithFallback()` 제거 실험

**수정 파일**

- `frontend/src/components/editor/extensions/SlashCommand.js`

**변경 내용**

- fallback 함수 제거
- `defaultFindSuggestionMatch` import 제거
- suggestion 설정의 `findSuggestionMatch` 지정 제거

**제거 근거**

- Tiptap 기본 matcher가 query, prefix, cursor 위치, range를 처리한다.
- cursor를 한 칸 임의로 이동하는 fallback은 실제 삭제 범위를 왜곡할 수 있다.

**테스트**

- 빈 `/`
- `/텍스트` 검색 및 Enter
- 문장 중간 slash
- 한글 조합 입력
- cursor 이동 후 메뉴 종료
- slash 직후 Enter
- 방향키와 마우스 클릭
- 이미지 명령 실행 후 slash 범위 삭제

**검증 기준**

```text
range.from = slash 시작 위치
range.to   = 현재 query 끝 위치
```

명령 실행 결과의 삭제 범위가 위 range와 일치해야 한다.

**문제 발생 시 복구**

- 기본 matcher에서 실제 회귀가 재현된 경우에만 fallback을 복구한다.
- 복구 전 Tiptap 버전, selection 변경, ReactRenderer timing, popup focus/scroll을 확인한다.

### 8단계: Slash 전용 transaction 디버깅 코드 제거

**수정 파일**

- `frontend/src/components/editor/NotionEditor.jsx`

**변경 내용**

- `transactionDebugRef` 제거 검토
- `onTransaction` 제거 검토
- `handleTextInput`의 DOM selection 로그 제거
- 원인 분석용 Slash 주석 정리

**제거 근거**

- Enter 우회와 matcher fallback 제거 후 기본 Suggestion 흐름이 안정적이면 상세 transaction 추적은 필요하지 않다.
- `handleTextInput`이 로그 후 `false`만 반환한다면 제거 후보가 된다.

**테스트**

- `/` 및 한글 조합 입력
- 일반 텍스트 입력
- 이미지/PDF 업로드
- 자동 저장과 localStorage 복구
- 기존 노트 열기 및 편집
- heading, paragraph, list, task list Enter

**문제 발생 시 복구**

- 문제가 발생한 코드만 복구한다.
- 전체 디버깅 코드를 되돌리지 않고 필요한 최소 추적만 재도입한다.

## 최종 구조

```text
NotionEditor
 └─ SlashCommand
     └─ Tiptap Suggestion
         └─ SuggestionList
             └─ command
```

최종적으로 `SlashCommand.js`에는 `/` trigger, suggestion command, Tiptap Suggestion 연결만 남기는 것을 목표로 한다. `NotionEditor.jsx`는 명령 정의와 popup renderer를 담당하고, `SuggestionList.jsx`는 선택 UI와 command 호출만 담당한다.

## 최종 검증

### Slash UX

- `/` 메뉴 표시
- 검색어 필터링
- ArrowUp/ArrowDown
- Enter 명령 실행
- 마우스 클릭
- Escape 닫기
- 메뉴 종료 후 일반 Enter
- 메뉴 내부 이동과 스크롤 후 키보드 선택

### 명령 및 기존 기능

- 텍스트, 제목, 불렛 리스트, 할 일 목록, 코드 블록, 인용구
- 이미지/PDF 업로드
- 하위 노트 생성
- 기존 heading/paragraph/list/task list Enter
- 기존 노트, page link, block 기능

### 저장 및 프로젝트 검증

- localStorage 임시 저장 및 복구
- 2초 debounce 서버 저장
- 저장 실패 상태
- `frontend`에서 `npm.cmd run lint`
- `frontend`에서 `npm.cmd run build`
- `package.json`과 `package-lock.json` root dependency 일치 여부

## 제외 범위

- 백엔드 API, DB, 인증, 마이그레이션
- 노트 저장 형식과 업로드 API 계약
- Slash 명령의 기능 추가
- 새로운 추상화나 라이브러리 도입
- 관련 없는 작업 트리 변경

## 진행 원칙

- 한 단계에서 하나의 workaround만 제거한다.
- 각 단계의 테스트가 통과한 뒤 다음 단계로 진행한다.
- 회귀가 발생하면 해당 단계만 복구하고 원인을 확인한다.
- 기존 사용자 변경 사항을 덮어쓰거나 되돌리지 않는다.
