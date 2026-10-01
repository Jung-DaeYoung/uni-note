# 과잉 구현 정리 계획 (2026-10-01)

`ponytail-audit`으로 저장소 전체(backend main, frontend src, 의존성)를 훑어 찾은 과잉 구현 20건을 정리한다. 동작·API 응답·DB 저장 형식은 바꾸지 않고, 코드 양만 줄인다.

## 범위와 원칙

- 대상은 중복 코드, 쓰이지 않는 코드, 표준 라이브러리로 대체할 수 있는 코드다. 버그·보안·성능은 범위 밖이다.
- REST 경로, 응답 필드명, 상태 코드, 오류 메시지 문구, 화면 동작은 그대로 유지한다.
- 테스트 코드는 감사 대상이 아니었다. 정리한 코드를 검증하던 테스트만 함께 고친다.
- 줄 수는 추정치다. 전체 약 -237줄, 의존성 -2개.
- 단계마다 따로 커밋할 수 있게 서로 독립적으로 나눴다. 순서는 줄어드는 양이 큰 순이다.

## 구현 단계

### 1. backend: 예외 핸들러 중복 제거 (약 -45줄)

- `GlobalExceptionHandler`의 핸들러 10개가 `ErrorResponse` 생성 8줄을 그대로 반복한다.
- `respond(HttpStatus status, String errorCode, String message)` private 헬퍼를 만들고 각 핸들러는 이를 호출한다.
- `errorCode` 문자열, 상태 코드, 메시지, 기존 `log.error` 호출은 그대로 둔다.

### 2. backend: AI 퀴즈 생성 정리 (약 -41줄)

- `QuizGenerationInput.contentHash()` 삭제. 로그 필드 하나를 위해 텍스트와 미디어 base64 전체를 SHA-256으로 해시하는데, 이 값을 읽는 코드가 없다. `GenerationContext.contentHash`와 로그의 `contentHash=`도 함께 지운다.
- `QuizService.logGenerationResult`에서 `regenerated=`(→ `attempts > 1`로 유도 가능), `scope=`(→ `blockCount == 0`으로 유도 가능) 필드 삭제.
- `QuizService.validateGenerationLimits`의 `typeCounts` null/empty 검사 삭제. `QuizRequest`의 `@NotEmpty`와 컨트롤러 `@Valid`가 이미 막는다.
  - 유형별 범위 검사의 `count == null` 가드는 남긴다. `@Min`/`@Max`는 null 값을 통과시킨다.
- `QuizService`의 `notes.isEmpty()` 가드 2곳(`saveGeneratedQuiz`, `validateSameCourse`) 삭제. `noteIds`는 `@NotEmpty`이고 `validateNoteAccess`가 개수 일치를 확인하므로 도달하지 않는다.
- `QuizQualityValidator.validateCounts`의 총 문항 수 검사 삭제. 유형별 개수 검사와 "문제 유형이 없습니다" 오류로 이미 걸러진다.
- `QuizQualityValidator.isBlank` 삭제, Spring `StringUtils.hasText`로 대체.

### 3. frontend: 에디터 중복 제거 (약 -57줄)

- `NotionEditor.jsx` 슬래시 명령 6개(제목 1·2, 할 일 목록, 불렛 리스트, 코드 블록, 인용구)가 같은 모양이다. `[title, icon, chain => chain.toggleX()]` 표에서 `map`으로 만든다. 명령 순서와 제목 문구는 유지한다.
- `NotionEditor.jsx` 이미지·PDF 슬래시 명령의 `<input type="file">` 생성 코드를 `pickFile(accept, onFile)` 하나로 합친다.
- `useNoteUploads.js`의 `handleImageUpload`와 `handlePdfUpload`를 내부 `upload(file, { endpoint, extensions, mimeTypes, label })` 하나로 합친다. 두 함수의 이름과 반환 형식(이미지는 URL 문자열, PDF는 `{ url, title }`)은 유지한다.

### 4. backend: 업로드·인증 정리 (약 -32줄)

- `ImageUploadController`의 서빙 엔드포인트 3개가 파일명 검증과 인가 전처리를 반복한다. 전처리를 `serveFile(fileName, owner, sig, originalName)` 안으로 옮기고 `isValidFileName`을 지운다.
  - 파일명 형식 오류(400)를 인가 실패(403)보다 먼저 판정하는 순서는 유지한다.
- `ImageUploadController.startsWith` 삭제, `Arrays.equals(content, 0, n, prefix, 0, n)`으로 대체(길이 검사 포함).
- `Files.exists` 검사 삭제. `Files.createDirectories`는 디렉터리가 이미 있어도 실패하지 않는다.
- `JwtUtil.validateToken`과 `getStudentNum`이 같은 토큰을 두 번 파싱한다. 실패 시 null을 반환하는 `parseSubject(token)` 하나로 합치고 `JwtFilter`를 맞춘다.

### 5. backend: 오답노트 서비스 정리 (약 -22줄)

- `IncorrectNoteService`에서 `findById().orElseThrow()` + `validateOwnership` 조합이 4번 반복된다. `getOwnedGroup(groupId, student)`로 뽑는다.
- `QuestionReviewStat`가 `QuestionAnswerStat`의 필드 7개를 그대로 복사한다. `stat` 참조와 파생 필드 4개(`question`, `accuracyRate`, `recentlyIncorrect`, `reviewPriority`)만 보관한다.
- 통계 응답 DTO의 필드와 정렬 순서는 그대로다.

### 6. frontend: 나머지 정리 (약 -37줄)

- `useCourseBoard.js`의 댓글 작성·수정·삭제 핸들러가 "목록 재조회 후 선택 글 갱신" 5줄을 반복한다. `refreshPosts()`로 뽑는다.
- `QuizConfigModal.jsx`의 `ScopeCheckbox` 컴포넌트 삭제, `<input>`에 콜백 ref `ref={el => { if (el) el.indeterminate = isPartial; }}`를 직접 쓴다.
- `QuizConfigModal.jsx`의 payload 삼항 두 분기를 객체 하나와 `...(partialNoteIds.length > 0 && { blockSelections })`로 합친다. 블록 선택이 없을 때 payload에 `blockSelections` 키가 없어야 하는 점은 유지한다.
- `CourseContext.jsx`에서 소비자가 없는 `studentName`, `isLoading`, `refreshCourses` 삭제. `/dashboard/courses` 응답은 그대로다.
- `AuthContext.jsx`의 `decodeJwtPayload`를 `JSON.parse(atob(base64))`로 줄인다. `exp`만 읽으므로 UTF-8 복원이 필요 없다.
- `useSourceBlockScroll.js`의 `scrollToBlockId` fallback 삭제. 호출부가 없다.

### 7. frontend: 쓰지 않는 파일·의존성 삭제

- 참조가 없는 템플릿 에셋 4개 삭제: `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg`, `public/icons.svg`.
- import하지 않는 `@tiptap/extension-bubble-menu`를 `package.json`에서 제거하고 `package-lock.json`을 갱신한다.

### 8. (선택) lodash.debounce 제거

- `useNoteAutosave.js`의 debounce 두 개를 `setTimeout`/`clearTimeout`으로 바꾸면 의존성이 하나 준다.
- 줄 수는 줄지 않고 자동 저장 debounce 계약(서버 2000ms, localStorage 300ms, `cancel`)을 건드리므로 우선순위가 가장 낮다. 1~7단계와 따로 판단한다.

## 수정 대상 파일

backend (`backend/src/main/java/com/uninote/backend/`)

- `exception/GlobalExceptionHandler.java`
- `service/QuizGenerationInput.java`, `service/QuizService.java`, `service/QuizQualityValidator.java`
- `service/IncorrectNoteService.java`
- `controller/ImageUploadController.java`
- `security/JwtUtil.java`, `security/JwtFilter.java`

frontend (`frontend/`)

- `src/components/editor/NotionEditor.jsx`
- `src/components/editor/hooks/useNoteUploads.js`, `useSourceBlockScroll.js`, `useNoteAutosave.js`(8단계만)
- `src/components/editor/components/QuizConfigModal.jsx`
- `src/hooks/useCourseBoard.js`
- `src/context/CourseContext.jsx`, `src/context/AuthContext.jsx`
- `package.json`, `package-lock.json`, 에셋 4개

## 테스트

- 삭제한 코드를 직접 검증하던 테스트는 함께 지우거나 고친다.
  - `QuizServiceTest`: `contentHash`, 로그 필드, `typeCounts` 빈 값 검사 관련
  - `QuizAiGenerationServiceTest`: `contentHash` 관련
  - `QuizQualityValidatorTest`: 총 문항 수 불일치 메시지를 기대하는 단정
  - `JwtUtilTest`: `validateToken`/`getStudentNum` 호출부
- 그 밖의 기존 테스트는 수정 없이 통과해야 한다. 특히 `GlobalExceptionHandlerTest`, `ImageUploadControllerTest`, `IncorrectNoteServiceTest`, `QuizConfigModal.test.jsx`, `AuthContext.test.jsx`가 응답 형식과 동작이 그대로임을 확인해 준다.
- 새 테스트는 추가하지 않는다.

## 검증

```powershell
cd backend
.\gradlew.bat test

cd ..\frontend
npm run lint
npm run build
npm run test
```

수동 확인

- 노트에서 슬래시 명령 10개가 기존 순서대로 나오고 각각 동작하는지.
- 이미지·PDF 업로드(슬래시 명령, 드래그 앤 드롭)와 업로드한 파일 보기·다운로드.
- 로그인 후 새로고침해도 인증이 유지되는지, 만료 토큰이 정리되는지.
- 게시판 댓글 작성·수정·삭제 후 목록과 상세가 갱신되는지.
- AI 문제 생성에서 노트 전체 선택과 블록 일부 선택이 모두 되는지, 일부 블록 노트의 체크박스가 부분 선택으로 보이는지.
- 오답노트 통계와 오늘의 복습 수치가 정리 전과 같은지.

## 완료 기준

- 1~7단계가 반영되고 backend 테스트, frontend lint·build·test가 모두 통과한다.
- REST 경로, 응답 필드, 상태 코드, 오류 메시지, 화면 동작이 정리 전과 같다.
- `quiz.generation` 로그에서 `contentHash`, `regenerated`, `scope` 필드만 빠진다.
