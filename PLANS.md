# UniNote 작업 계획

## 작업 목표

UniNote의 Tiptap Slash Command 구조를 기능 변경 없이 단계적으로 단순화한다.

- Notion과 유사한 Slash Command UX 유지
- Tiptap `Suggestion`의 기본 기능 최대한 활용
- 초보자가 이해하기 쉬운 구조 유지
- 새로운 추상화나 복잡한 구조 추가 금지
- 한 번에 여러 workaround를 삭제하지 않고, `1개 변경 → 테스트 → 다음 변경` 순서로 진행

## 분석 대상

- `frontend/src/components/editor/extensions/SlashCommand.js`
- `frontend/src/components/editor/NotionEditor.jsx`
- `frontend/src/components/editor/components/SuggestionList.jsx`

## 목표 구조

```text
NotionEditor
 └─ SlashCommand
     └─ Tiptap Suggestion
         └─ SuggestionList
             └─ command
```

### 계층별 책임

- `NotionEditor.jsx`: Slash 항목 목록과 실제 editor command 정의, 자동 저장 연결
- `SlashCommand.js`: `/` trigger와 Tiptap `Suggestion` 연결
- Tiptap `Suggestion`: 매칭, query, range, active 상태, 키 이벤트 전달
- `SuggestionList.jsx`: 선택 인덱스, 방향키, Enter, 마우스 클릭 UI
- 각 item의 `command`: 문서 변환, 이미지/PDF 업로드, 하위 노트 생성

## 현재 구조와 주요 위험

현재 Slash Command는 Tiptap 기본 키보드 흐름 외에 다음 우회 코드를 함께 사용한다.

- `SlashCommand.js`
  - `addStorage().pendingEnterHandler`
  - `addKeyboardShortcuts().Enter`
  - `findSuggestionMatchWithFallback()`
- `NotionEditor.jsx`
  - `suggestionRef`
  - `lastKnownSuggestionRef`
  - `pendingEnterHandler` 등록 및 정리
  - transaction, DOM selection, renderer 상태를 위한 디버깅 로그
- `SuggestionList.jsx`
  - 선택과 키 입력 결과를 출력하는 디버깅 로그

이 코드는 과거 Enter 이벤트가 Suggestion에 도달하지 않고 일반 줄바꿈으로 처리되는 문제를 보완하기 위해 추가된 것으로 보인다. 실제 문제가 현재도 재현되는지 확인하기 전에는 workaround를 삭제하지 않는다.

## 반드시 보존할 기능

### Slash UX

- `/` 입력 시 메뉴 표시
- 검색어 입력 및 필터링
- ArrowUp/ArrowDown 선택
- Enter로 현재 명령 실행
- 마우스 클릭으로 명령 실행
- Escape로 메뉴 닫기
- 메뉴가 닫힌 후 일반 Enter 동작
- 메뉴 내부 마우스 이동과 스크롤 후 키보드 선택

### 명령 및 문서 기능

- 텍스트
- 제목 1/2
- 불렛 리스트
- 할 일 목록
- 코드 블록
- 인용구
- 이미지 업로드
- PDF 업로드
- 하위 노트 생성
- 기존 heading, paragraph, list, task list의 Enter 동작
- 기존 노트 내용, Tiptap JSON, page link, block 기능

### 저장 및 비동기 기능

- 입력 후 localStorage 임시 저장
- 2초 debounce 서버 자동 저장
- 저장 상태 표시
- localStorage 복구
- 이미지/PDF 업로드 API
- 하위 노트 생성 API
- 업로드 및 저장 실패 처리

## 단계별 리팩터링 계획

### 0단계: 기준 동작 기록

**수정 파일**

- 없음

**확인할 내용**

- `/`, 검색어, 방향키, Enter, 마우스 클릭, Escape
- 메뉴가 닫힌 후 일반 Enter
- 이미지/PDF 업로드와 하위 노트 생성
- 자동 저장, localStorage 복구, 기존 노트 편집
- heading, paragraph, list, task list Enter

**제거 근거**

- 없음. 코드 변경 전에 현재 동작을 기준선으로 고정한다.

**테스트**

- 위 기능을 수동으로 실행하고, Enter가 실행되는지와 일반 줄바꿈이 중복되지 않는지 기록한다.

**문제 발생 시 복구**

- 코드 변경 전이므로 현재 동작을 원인 분석의 기준으로 사용한다.

### 1단계: `SuggestionList.jsx` 디버깅 로그 제거

**수정 파일**

- `frontend/src/components/editor/components/SuggestionList.jsx`

**제거/변경 코드**

- item 선택 전후 `console.log`
- `onKeyDown` 입력 및 반환값 로그

**제거 근거**

- 로그는 선택 인덱스, command 실행, 마우스 포커스 유지, 스크롤 동작을 변경하지 않는다.

**테스트**

- 방향키 선택
- 방향키 후 Enter
- 마우스 클릭
- Escape
- 메뉴 내부 스크롤 후 Enter
- 빈 검색 결과에서 Enter

**문제 발생 시 복구**

- `SuggestionList.jsx`의 로그만 복구한다. 다른 workaround는 변경하지 않는다.

### 2단계: `SlashCommand.js` command 로그 제거

**수정 파일**

- `frontend/src/components/editor/extensions/SlashCommand.js`

**제거/변경 코드**

- `props.command start/end` 로그

**유지할 코드**

- `/` trigger
- suggestion `command`
- `props.command({ editor, range })`
- `pendingEnterHandler`
- `findSuggestionMatchWithFallback()`

**제거 근거**

- 명령 실행 전후 JSON 출력은 기능에 필요하지 않다.

**테스트**

- 텍스트, 제목, 목록, 할 일 목록, 코드 블록, 인용구
- 이미지/PDF 업로드
- 하위 노트 생성

**문제 발생 시 복구**

- command 로그만 복구한다.

### 3단계: `NotionEditor.jsx` renderer 로그 제거

**수정 파일**

- `frontend/src/components/editor/NotionEditor.jsx`

**제거/변경 코드**

- `onStart`, `menu shown`, `onUpdate`, renderer `onKeyDown`, `onExit` 로그

**일단 유지할 코드**

- `onTransaction` 상세 로그
- `handleTextInput` DOM selection 로그
- `transactionDebugRef`

**제거 근거**

- renderer 로그는 popup 생성, props 갱신, 키 이벤트 전달, cleanup을 변경하지 않는다.

**테스트**

- 검색어 입력 중 popup 위치 갱신
- 방향키와 Enter
- Escape 후 popup 제거
- 마우스 클릭

**문제 발생 시 복구**

- renderer 로그만 복구하고 transaction 추적 코드는 유지한다.

### 4단계: 기본 Suggestion Enter 흐름 검증

**수정 파일**

- 없음. `pendingEnterHandler`를 유지한 채 동작을 확인한다.

**확인할 코드 흐름**

```text
Suggestion.handleKeyDown
 └─ active 확인
     └─ renderer.onKeyDown
         └─ suggestionRef.onKeyDown
             └─ SuggestionList.onKeyDown
```

**제거 근거**

- `pendingEnterHandler`를 제거하기 전에 기본 Tiptap 흐름이 실제로 안정적인지 확인해야 한다.

**테스트**

- `/` 직후 Enter
- 검색어 입력 후 Enter
- ArrowUp/ArrowDown 후 Enter
- `onUpdate` 직후 Enter
- 메뉴 스크롤 후 Enter
- Escape 후 일반 Enter
- Enter가 일반 줄바꿈으로 중복 처리되는지

**확인할 문제**

- renderer `onKeyDown`이 호출되지 않는지
- Suggestion `active`가 false가 되는지
- `suggestionRef`가 null이 되는지
- Enter 전에 `onExit`가 호출되는지

**문제 발생 시 복구**

- 코드 변경이 없으므로 로그와 plugin 상태를 추가로 확인한다. 원인 확인 전에는 다음 삭제 단계로 진행하지 않는다.

### 5단계: `pendingEnterHandler` 제거

**수정 파일**

- `frontend/src/components/editor/extensions/SlashCommand.js`
- `frontend/src/components/editor/NotionEditor.jsx`

**제거/변경 코드**

`SlashCommand.js`

- `addStorage()`
- `pendingEnterHandler`
- `addKeyboardShortcuts()`
- custom `Enter` keymap

`NotionEditor.jsx`

- `onStart`의 `pendingEnterHandler` 등록
- `onExit`의 handler 정리
- handler 목적의 주석

**제거 근거**

- Tiptap Suggestion이 active 상태에서 기본 `handleKeyDown`으로 renderer의 `onKeyDown`을 호출한다.
- `SuggestionList`는 Enter에서 command를 실행하고 `true`를 반환한다.
- 기본 흐름이 4단계 검증을 통과한 경우 별도 Enter 우회가 중복된다.

**테스트**

- `/` 후 Enter
- 검색어 후 Enter
- ArrowUp/ArrowDown 후 Enter
- 메뉴 내부 이동 및 스크롤 후 Enter
- 마우스 클릭
- Escape 후 일반 Enter
- heading, paragraph, list, task list 일반 Enter
- 이전 메뉴 종료 후 다음 Enter

**문제 발생 시 복구**

- `pendingEnterHandler`와 custom Enter keymap만 복구한다.
- `findSuggestionMatchWithFallback()`은 함께 복구하지 않아 원인을 분리한다.

### 6단계: `lastKnownSuggestionRef` 제거 검토

**수정 파일**

- `frontend/src/components/editor/NotionEditor.jsx`

**제거/변경 코드**

- `lastKnownSuggestionRef`
- 마지막 유효 ref를 보관하는 `setSuggestionRef` 로직
- stale ref 보완용 주석

**제거 근거**

- `pendingEnterHandler` 제거 후 마지막 ref를 별도 보관할 목적이 사라진다.
- Tiptap 기본 renderer 흐름에서는 현재 `SuggestionList` ref만 사용하면 된다.

**테스트**

- `onStart` 직후 Enter
- 검색어 입력 직후 Enter
- ArrowDown 직후 Enter
- `onUpdate` 직후 Enter
- 마우스 클릭 및 Escape

**문제 발생 시 복구**

- `lastKnownSuggestionRef`만 복구한다.
- `pendingEnterHandler`는 다시 추가하지 않는다.

### 7단계: `findSuggestionMatchWithFallback()` 제거 실험

**수정 파일**

- `frontend/src/components/editor/extensions/SlashCommand.js`

**제거/변경 코드**

- `findSuggestionMatchWithFallback()` 함수
- `defaultFindSuggestionMatch` import
- suggestion 설정의 `findSuggestionMatch` 지정

**제거 근거**

- Tiptap 기본 matcher가 query, prefix, cursor 위치, suggestion range를 처리한다.
- 임의로 cursor를 한 칸 앞당기는 fallback은 실제 cursor와 command 삭제 범위를 다르게 만들 수 있다.

**테스트**

- 빈 `/`
- `/텍스트` 필터링
- 검색어 후 Enter와 실제 slash 범위 삭제
- 문장 중간 slash
- 한글 조합 입력
- cursor 이동 후 메뉴 종료
- slash 직후 Enter
- 마우스 클릭
- 이미지 명령 실행

**검증 기준**

```text
range.from = slash 시작 위치
range.to   = 현재 query 끝 위치
```

기본 matcher 제거 후에도 위 범위와 실제 삭제 결과가 일치해야 한다.

**문제 발생 시 복구**

- 기본 matcher에서 실제 회귀가 재현된 경우에만 fallback을 복구한다.
- 복구 전 Tiptap 버전, selection 변경, ReactRenderer timing, popup focus/scroll, custom input handler를 먼저 확인한다.

### 8단계: Slash 전용 transaction 디버깅 코드 제거

**수정 파일**

- `frontend/src/components/editor/NotionEditor.jsx`

**제거/변경 코드**

- `transactionDebugRef`
- `onTransaction`
- `handleTextInput`의 DOM selection 로그
- 원인 분석용 Slash 주석

**제거 근거**

- Enter 우회와 matcher fallback 제거 후 기본 Suggestion 흐름이 안정적이면 transaction 상세 추적은 기능에 필요하지 않다.
- `handleTextInput`이 단순히 로그 후 `false`를 반환한다면 제거 후보가 된다.

**테스트**

- `/` 및 한글 조합 입력
- 일반 텍스트 입력
- 이미지/PDF 업로드
- 자동 저장과 localStorage 복구
- 기존 노트 열기 및 편집
- heading, paragraph, list, task list Enter

**문제 발생 시 복구**

- 문제가 난 코드만 복구한다.
- 전체 디버깅 로그를 되돌리기보다 필요한 최소 추적만 다시 추가한다.

## 최종 검증

### 기능 회귀

- Slash 메뉴 표시, 필터링, 방향키, Enter, 마우스 클릭, Escape
- 메뉴 종료 후 일반 Enter
- 이미지/PDF 업로드
- 하위 노트 생성
- heading/paragraph/list/task list 동작
- 자동 저장, localStorage 복구, 기존 노트 기능

### 명령 range 검증

- `/`, `/텍스트`, 문장 중간 slash
- 한글 조합 입력
- cursor 이동
- 방향키와 마우스 조작 후 command 실행
- slash부터 query까지 정확히 삭제되는지

### 프로젝트 검증

- `frontend`에서 `npm run lint`
- `frontend`에서 `npm run build`
- `package.json`과 `package-lock.json`의 root dependency 일치 여부
- 관련 없는 작업 트리 변경은 수정하거나 되돌리지 않음

## 작업 원칙

- 한 단계에서 하나의 workaround만 제거한다.
- 각 변경 후 해당 단계의 테스트를 통과해야 다음 단계로 진행한다.
- 기능 회귀가 발생하면 해당 단계만 복구하고 원인을 확인한다.
- 새로운 추상화, 공통 레이어, 라이브러리는 추가하지 않는다.
- 기존 API, 저장 형식, 인증, 업로드 흐름은 변경하지 않는다.
