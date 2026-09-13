# 현재 작업 계획: 프런트엔드 책임 분리와 노트·퀴즈 흐름 보존

## 작업 목표

`CourseDetailPage`, `NotionEditor`, `QuizLibraryPage`에 집중된 화면 상태·CRUD·저장·업로드·퀴즈 로직을 기존 React 컴포넌트와 hook 단위로 분리한다. API 경로와 응답 형식, Tiptap 문서 JSON, Block ID·페이지 링크·PDF 블록, 자동 저장과 localStorage 복구, 퀴즈·오답노트 흐름을 바꾸지 않는다.

이번 작업은 구조 개선이다. 백엔드 API·DB·인증 정책과 화면 기능·문구의 의도된 변경은 포함하지 않으며, 새 상태 관리 라이브러리나 테스트 프레임워크를 추가하지 않는다.

## 확인한 현재 상태와 근거

- `frontend/src/pages/CourseDetailPage.jsx`는 약 580줄로 노트 트리 조회/생성/삭제·경로 이동, 노트 조회, 게시판·댓글 CRUD, 사이드바와 게시판 렌더링을 함께 가진다.
- `frontend/src/components/editor/NotionEditor.jsx`는 Tiptap 확장 설정, 이미지/PDF 업로드, 2초 debounce 저장, `note-temp-{noteId}` localStorage 복구, Block ID 기반 출처 스크롤, AI 퀴즈 모달/플레이어를 함께 가진다.
- `frontend/src/pages/QuizLibraryPage.jsx`는 퀴즈·풀이 이력·오답노트 탭별 조회, 재풀이/복습/삭제, 상세 플레이어와 이력 모달 상태를 한 화면에서 처리한다.
- `frontend/src/api/client.js`는 `/api` base URL, Bearer 토큰 주입, 403 수강 권한 처리, 401 로그아웃 처리를 담당한다. 모든 신규 요청은 이 인스턴스를 계속 사용해야 한다.
- `BlockId`, `PageLink`, `PdfBlock` 확장과 `NoteTreeContext`는 저장 JSON과 노트 제목·출처 이동에 관여한다. 노드 이름, attrs와 저장 형식은 변경하면 안 된다.
- `frontend/package.json`에는 lint/build만 있고 단위 테스트 도구가 없다. 이번 범위에서는 기존 도구를 추가하지 않는다.

## 수정 대상과 책임 경계

1. `CourseDetailPage`
   - 라우트 파라미터, 레이아웃 조합, 화면 간 상태 연결만 유지한다.
   - 노트 트리와 현재 노트의 조회·생성·삭제·이동은 전용 hook 또는 하위 컴포넌트로 분리한다.
   - 게시글/댓글의 목록·상세·작성·수정·삭제 상태와 UI는 독립된 게시판 hook/컴포넌트로 분리한다.
   - 첫 노트 자동 이동·생성, `postId` query 처리, 삭제 뒤 이동 규칙을 보존한다.

2. `NotionEditor`
   - 에디터 확장 구성·렌더링과 퀴즈 UI 조합은 컴포넌트에 둔다.
   - 업로드, 초기 콘텐츠/localStorage 복구, debounce 자동 저장, 출처 블록 스크롤을 각각 재사용 가능한 hook 또는 작은 모듈로 분리한다.
   - 기존 `PUT /notes/{noteId}` 본문(`title`, `content`, `previewText`, `searchContent`), 2초 debounce, 저장 상태, `onSaved` 호출과 실패 표시를 유지한다.
   - 이미지/PDF 업로드 경로와 반환 URL 처리, `BlockId`/`PageLink`/`PdfBlock`의 JSON 노드·attrs는 변경하지 않는다.

3. `QuizLibraryPage`
   - 탭별 API 조회와 재풀이·이력·오답노트 액션을 hook으로 분리하고, 탭 패널/카드 렌더링을 하위 컴포넌트로 분리한다.
   - `/quiz/my`, `/quiz/{id}`, `/quiz/attempts/my`, `/quiz/attempts/{id}`, 오답노트 그룹·연습 API와 `CBTPlayer`, `QuizAttemptsModal`의 전달 데이터는 유지한다.

4. API 호출 모듈
   - 화면에서 반복되는 노트·게시판·퀴즈 API 호출은 도메인별 함수로 정리할 수 있으나, 모두 `src/api/client.js`를 사용한다.
   - `client.js`의 base URL, 토큰 인터셉터, 401/403 동작은 보존한다. URL·환경 설정을 새로 하드코딩하지 않는다.

## 구현 순서

1. 먼저 각 화면의 API 호출·상태·UI 경계를 식별하고, 기존 요청 경로·요청 본문·응답 사용 필드를 목록화한다.
2. `CourseDetailPage`에서 노트 트리/CRUD와 게시판·댓글 기능을 분리한 뒤, 라우트 전환·삭제 후 이동·게시판 deep link를 확인한다.
3. `NotionEditor`에서 저장/복구·업로드·출처 스크롤을 분리한다. Tiptap extensions, 저장 JSON, debounce 취소/재생성 시점은 기존과 같은 동작을 유지한다.
4. `QuizLibraryPage`의 데이터 조회·액션과 탭 UI를 분리하고, quizSetId/courseId/attemptId 전달이 바뀌지 않는지 확인한다.
5. 필요하면 API 함수를 모듈화하되 Axios 직접 생성이나 `client.js` 우회는 하지 않는다.
6. `npm run lint`, `npm run build`와 아래 핵심 수동 시나리오로 확인한다.

## 유지해야 할 계약

- 노트 API 경로와 저장 본문, Tiptap JSON, `BlockId`의 `data-id`, `PageLink`의 `noteId`/`title`, `PdfBlock`의 `src`/`title`을 유지한다.
- `note-temp-{noteId}` 키, 서버/로컬 최신본 선택, 자동 저장 debounce와 저장 상태 표시는 유지한다.
- 업로드 API(`/upload/image`, `/upload/file`)와 노트·게시판·댓글·퀴즈·오답노트 API의 메서드, 경로, 요청/응답 필드를 유지한다.
- Axios Bearer 헤더, 401 로그아웃, `FORBIDDEN_COURSE_ACCESS` 403 처리와 기존 protected route 흐름을 유지한다.
- 퀴즈 생성 결과의 `quizSetId`, 문항 출처(`sourceNoteId`, `sourceBlockId`), 재풀이/풀이 결과/오답 복습의 `CBTPlayer` 입력 형태를 유지한다.

## 이번 작업에서 수정하지 않을 범위

- 백엔드 Controller·Service·DTO·DB 스키마, REST API 계약, JWT/권한 정책 변경.
- Tiptap 확장 노드 스키마, 파일 URL/다운로드 정책, 업로드 MIME 정책 변경.
- autosave 시간, localStorage 키·복구 우선순위, AI 퀴즈 요청 내용 변경.
- 새 전역 상태 관리 라이브러리, 새 테스트 프레임워크, 디자인 전면 개편.

## 테스트 및 완료 조건

1. `frontend`에서 `npm run lint`와 `npm run build`가 통과한다.
2. 노트 생성·트리 이동·하위 노트 생성·삭제 후 이동, 제목/본문 자동 저장과 새로고침 뒤 localStorage 복구를 확인한다.
3. 이미지/PDF 업로드, PageLink 이동, Block ID 출처 스크롤을 확인한다.
4. 게시글·댓글 CRUD와 대시보드의 `postId` deep link를 확인한다.
5. 퀴즈 생성, 보관함 재풀이, 풀이 이력 상세, 오답노트 추가·복습·삭제가 기존 API 요청과 화면 흐름을 보존하는지 확인한다.
6. 모든 프런트엔드 요청이 `client.js`를 경유하고 401/403 처리가 유지되는지 확인한다.
