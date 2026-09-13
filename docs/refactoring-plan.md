# UniNote 리팩터링 분석 계획

> 분석 기준: 2026-09-10  
> 범위: 실행 소스, 설정, 테스트, 기존 문서  
> 원칙: 기존 기능을 유지하며 단계적으로 구조와 유지보수성을 개선한다.  
> 이번 작업에서는 애플리케이션 소스 코드를 수정하지 않았다.

## 1. 분석 범위와 파일 집계

생성 산출물과 외부 의존성은 동작 소스 분석에서 제외했다.

- 제외: `frontend/node_modules/`, `backend/build/`, `backend/.gradle/`, `backend/uploads/`, `.git/`, IDE 메타데이터
- 포함: `backend/src/`, `frontend/src/`, `frontend/public/`, `docs/`, Gradle/npm 설정 파일
- 줄 수는 공백과 주석을 포함한 물리적 줄 수다.

| 영역 | 파일 수 | 줄 수 | 비고 |
|---|---:|---:|---|
| 백엔드 Java main | 72 | 2,315 | Controller/Service/Domain/DTO/Repository/Security 등 |
| 백엔드 리소스 | 1 | 21 | `application.yaml` |
| 백엔드 테스트 | 1 | 9 | Spring context 기본 테스트만 존재 |
| 프론트엔드 `src` | 29 | 3,467 | React 페이지, 에디터, Context, API |
| 프론트엔드 `public` | 2 | 25 | SVG 정적 리소스 |
| 프로젝트 문서 | 32 | 1,281 | 설계, 명세, 진행 문서 |
| **분석 대상 합계** | **137** | **7,118** | 이미지 바이너리 제외 |

### 1.1 백엔드 파일 목록

| 분류 | 파일 |
|---|---|
| 진입점/설정 | `BackendApplication.java`, `config/RestClientConfig.java`, `config/WebConfig.java`, `application.yaml` |
| 인증/보안 | `security/JwtFilter.java`, `security/JwtUtil.java`, `security/SecurityConfig.java` |
| Controller | `AuthController.java`(18), `DashboardController.java`(22), `ImageUploadController.java`(92), `IncorrectNoteController.java`(49), `NoteController.java`(53), `PostController.java`(65), `QuizController.java`(65) |
| Service | `AuthService.java`(38), `DashboardService.java`(75), `IncorrectNoteService.java`(106), `NoteService.java`(133), `PostService.java`(141), `QuizService.java`(375) |
| Domain | `Comment.java`, `Course.java`, `Enrollment.java`, `IncorrectNoteGroup.java`, `IncorrectNoteItem.java`, `Note.java`, `Post.java`, `Professor.java`, `Question.java`, `QuestionType.java`, `QuizAttempt.java`, `QuizDifficulty.java`, `QuizSet.java`, `QuizStatus.java`, `Student.java`, `UserAnswer.java` |
| DTO | `AddToIncorrectRequest.java`, `CommentRequest.java`, `CommentResponse.java`, `CourseResponse.java`, `DashboardResponse.java`, `IncorrectNoteGroupResponse.java`, `LoginRequest.java`, `LoginResponse.java`, `NoteRequest.java`, `NoteResponse.java`, `NoteSummaryResponse.java`, `NoteTreeResponse.java`, `PostRequest.java`, `PostResponse.java`, `QuestionResponse.java`, `QuizAttemptDetailResponse.java`, `QuizAttemptRequest.java`, `QuizAttemptResponse.java`, `QuizRequest.java`, `QuizResponse.java`, `QuizSetDetailResponse.java`, `QuizSetResponse.java` |
| Repository | `CommentRepository.java`, `CourseRepository.java`, `EnrollmentRepository.java`, `IncorrectNoteGroupRepository.java`, `IncorrectNoteItemRepository.java`, `NoteRepository.java`, `PostRepository.java`, `QuestionRepository.java`, `QuizAttemptRepository.java`, `QuizSetRepository.java`, `StudentRepository.java`, `UserAnswerRepository.java` |
| 예외/테스트 | `exception/CourseAccessException.java`, `ErrorResponse.java`, `GlobalExceptionHandler.java`, `BackendApplicationTests.java` |

괄호 안 숫자는 재검토 우선도가 높은 파일의 물리적 줄 수다. 나머지 Domain/DTO/Repository는 대부분 4~45줄의 단순 매핑 및 Spring Data 메서드 선언으로 구성된다.

### 1.2 프론트엔드 파일 목록

| 분류 | 파일 |
|---|---|
| 진입점/라우팅 | `main.jsx`(15), `App.jsx`(54), `routes/ProtectedRoute.jsx`(13) |
| API/상태 | `api/client.js`(33), `context/AuthContext.jsx`(22), `context/CourseContext.jsx`(34), `context/NoteTreeContext.jsx`(28) |
| 공통 레이아웃 | `components/layout/AppLayout.jsx`(143) |
| 페이지 | `pages/LoginPage.jsx`(68), `pages/DashboardPage.jsx`(165), `pages/CourseDetailPage.jsx`(554), `pages/QuizLibraryPage.jsx`(290) |
| 에디터 본체/확장 | `components/editor/NotionEditor.jsx`(555), `extensions/BlockId.js`(36), `PageLink.jsx`(49), `PdfBlock.jsx`(79), `SlashCommand.js`(28) |
| 에디터 하위 UI | `BlockHandle.jsx`(141), `CBTPlayer.jsx`(273), `CodeBlockComponent.jsx`(96), `IncorrectNoteModal.jsx`(155), `QuizAttemptsModal.jsx`(96), `QuizConfigModal.jsx`(195), `SuggestionList.jsx`(80) |
| 스타일/정적 파일 | `App.css`, `index.css`, `assets/hero.png`, `assets/react.svg`, `assets/vite.svg`, `public/favicon.svg`, `public/icons.svg` |

### 1.3 설정 및 문서 파일

- 빌드/의존성: `backend/build.gradle`, `backend/settings.gradle`, `backend/gradlew`, `backend/gradlew.bat`, `backend/gradle/wrapper/*`, `frontend/package.json`, `frontend/package-lock.json`, `frontend/vite.config.js`, `frontend/index.html`
- 설계/명세: `docs/architecture.md`, `docs/디렉토리구조.md`, `docs/db구조.md`, `docs/rest api 설계.md`, `docs/요구사항 명세서.md`, `docs/세부기능 명세서.md`, `docs/ai문제설계.md`
- 진행 기록: 날짜별 `docs/*.md`, `docs/progress.md`, `docs/계획.md`, `docs/GEMINI.md`

## 2. 전체 구조

### 2.1 백엔드

Spring Boot 3.4.2와 Java 21 기반의 전형적인 계층형 구조다.

```text
HTTP
  -> SecurityConfig / JwtFilter
  -> Controller
  -> Service
  -> Spring Data JPA Repository
  -> MySQL
```

- `controller`: 인증, 대시보드, 노트, 게시판/댓글, 퀴즈, 오답노트, 파일 업로드 API
- `service`: 수강 권한 확인, CRUD, 응답 DTO 변환, 퀴즈 생성/풀이 기록 저장
- `domain`: Student/Course/Enrollment를 중심으로 Note, Post, QuizSet/Question/Attempt를 연결
- `dto`: 요청/응답 모델을 별도 정의
- `security`: JWT 검증 후 학번을 `Authentication` principal로 전달
- `exception`: 일부 예외를 공통 JSON 응답으로 변환

### 2.2 프론트엔드

Vite + React 19 기반이며 React Router, Axios, Context API, Tiptap을 사용한다.

```text
main.jsx
  -> AuthProvider / CourseProvider / Router
  -> ProtectedRoute
  -> Page
  -> AppLayout + editor/board/quiz components
  -> api/client.js
  -> Spring REST API
```

- 대시보드: 수강 강의, 최근 노트, 최근 커뮤니티 게시글
- 강의 상세: 노트 트리, Tiptap 노트 편집기, 커뮤니티 사이드바
- 에디터: 자동 저장, 로컬 임시 저장, 블록 ID, 페이지 링크, 이미지/PDF 첨부, AI 퀴즈 생성
- 퀴즈 보관함: 생성 퀴즈, 풀이 기록, 오답노트, 재풀이/리포트
- 인증: `localStorage` 토큰을 Axios 요청 헤더에 넣고 401/403을 전역 처리

## 3. 주요 기능과 데이터 흐름

### 3.1 인증

1. `LoginPage`가 `/api/auth/login`으로 로그인 요청
2. 백엔드 `AuthService`가 학생을 조회하고 JWT를 발급
3. 프론트엔드가 토큰을 저장
4. `api/client.js` 요청 인터셉터가 `Authorization: Bearer ...`를 자동 추가
5. `JwtFilter`가 토큰을 검증하고 학번을 principal로 설정
6. 각 Controller가 principal/`Authentication`을 Service에 전달

### 3.2 노트 편집

1. `CourseDetailPage`가 게시글과 노트 트리를 조회
2. 노트가 없으면 첫 노트를 생성하고 `/course/:courseId/note/:noteId`로 이동
3. `NotionEditor`가 서버 JSON 또는 로컬 임시 JSON을 선택해 Tiptap 문서를 초기화
4. 수정 시 즉시 `localStorage`에 저장하고 2초 debounce 후 `PUT /api/notes/:noteId`
5. 백엔드는 title/content/preview/search 필드를 `Note`에 저장
6. `BlockId`, `PageLink`, `PdfBlock`이 AI 출처 추적과 노트 간 링크를 지원

### 3.3 커뮤니티

1. `CourseDetailPage`가 `/api/posts/:courseId`로 게시글 목록을 조회
2. 게시글/댓글 CRUD를 같은 페이지의 상태와 핸들러가 처리
3. `PostService`가 익명 표시명과 본인 여부를 계산해 `PostResponse`로 변환
4. 대시보드는 최신 게시글 일부를 별도로 조회해 강의 화면으로 연결

### 3.4 AI 퀴즈와 학습 이력

1. 에디터의 `QuizConfigModal`이 노트 ID, 난이도, 문제 유형/개수를 전송
2. `QuizService.generateQuiz`가 노트 JSON을 순회해 텍스트와 이미지/PDF를 Gemini 요청으로 조합
3. `[[REF:noteId/blockId]]` 메타데이터와 JSON Schema를 프롬프트에 포함
4. 응답을 `QuizResponse`로 파싱하고 `QuizSet`/`Question`을 저장
5. `CBTPlayer`가 답안을 제출하고 `QuizAttempt`/`UserAnswer`로 저장
6. `QuizLibraryPage`가 퀴즈 목록, 풀이 기록, 오답 그룹을 조회하고 재생/리포트 UI를 표시

## 4. 중복 코드와 불필요한 복잡성

### 4.1 응답 DTO 변환 중복

**대상:** `backend/.../service/QuizService.java:252-375`

- `getQuizDetail`, `getAttemptDetail`, `getQuestionResponse`가 Question -> QuestionResponse 변환을 각각 구현한다.
- options JSON 파싱, null 방어, source metadata 복사가 반복된다.
- `IncorrectNoteService`는 이미 `quizService.getQuestionResponse(q)`에 의존하고 있어 변환 책임이 서비스 간에 새어 있다.
- 같은 패턴이 Attempt 응답 생성에도 반복된다.

**영향:** Question DTO 필드가 바뀔 때 여러 메서드를 함께 수정해야 하고, 응답별 필드 누락 가능성이 커진다.

### 4.2 인증된 학생 조회 반복

**대상:** `QuizController.java:18-62`, `IncorrectNoteController.java:16-53`

- `StudentRepository.findByStudentNum(principal.getName())`와 동일한 예외 메시지가 여러 Endpoint에 반복된다.
- Controller가 인증 principal을 Student 엔티티로 변환하는 책임까지 가진다.

**영향:** 인증 주체 처리 방식 변경 시 여러 Controller를 수정해야 하며 API 코드가 비대해진다.

### 4.3 게시글/댓글의 익명 표시명 및 본인 판정 중복

**대상:** `PostService.java:80-117`, `DashboardService.java:47-65`

- `trim()` 여부가 메서드마다 다르고, `studId % 100` 표시 규칙도 각각 구현한다.
- 게시글 응답 변환이 PostService와 DashboardService에 분산돼 있다.

**영향:** 같은 사용자라도 화면별 표시명/본인 판정이 달라질 수 있다.

### 4.4 수강 권한 검증의 불완전한 적용

**대상:** `NoteService.java:28-43`, `PostService.java`, `QuizService.java`, `DashboardService.java`

- NoteService 일부 메서드는 `validateEnrollment`를 호출하지만 `getNoteTree`, `saveNote`는 동일한 수준의 소유자/강의 검증 흐름이 명확하지 않다.
- PostService의 게시글 조회/작성에는 수강 여부 검증이 직접 보이지 않는다.
- 권한 검증이 Controller가 아니라 각 Service 메서드에 흩어져 있다.

**영향:** 기능 추가 시 보호가 누락되기 쉽고, 권한 정책을 한눈에 확인하기 어렵다. 이는 단순 스타일 문제가 아니라 유지보수 및 보안 위험이다.

### 4.5 프론트엔드 페이지의 책임 집중

**대상:** `frontend/src/pages/CourseDetailPage.jsx:1-554`

- 노트 트리 렌더링, 트리 조회/삭제/생성, 게시판 목록/상세/작성/수정/삭제, 댓글 CRUD, URL query 처리, 레이아웃 상태를 한 컴포넌트가 관리한다.
- `useEffect`, `useMemo`, `useCallback` 의존성이 많아 기능 간 변경 영향 범위가 넓다.

**영향:** 게시판 또는 노트 기능을 독립적으로 테스트하기 어렵고, 상태 변경이 다른 화면 흐름을 깨뜨릴 가능성이 높다.

### 4.6 에디터 본체의 과도한 책임

**대상:** `frontend/src/components/editor/NotionEditor.jsx:1-555`

- Tiptap schema/extension 설정, slash command 메뉴, 이미지/PDF 업로드, drag-and-drop, 자동 저장, localStorage 복구, 출처 스크롤, AI 퀴즈 모달, 에디터 스타일이 한 파일에 있다.
- 업로드 API 주소가 컴포넌트 내부에 직접 하드코딩돼 있다.
- 초기 콘텐츠 계산, 저장 payload 구성, 로컬 임시 저장 정책이 UI 생명주기와 강하게 결합돼 있다.

**영향:** 에디터 기능 하나를 수정해도 저장/업로드/퀴즈/렌더링을 함께 검토해야 한다.

### 4.7 AI 생성 로직의 결합도와 오류 처리

**대상:** `backend/.../service/QuizService.java:1-220`

- 외부 Gemini 요청, 프롬프트, JSON Schema, Tiptap JSON 파싱, 파일 Base64 변환, DB 저장, 응답 DTO 조립이 375줄 서비스에 집중돼 있다.
- API URL, 모델명, 파일 경로 정책이 코드에 직접 존재한다.
- `catch (Exception)`으로 외부 호출/파싱/파일 처리 오류를 한 종류의 `RuntimeException` 또는 경고로 처리한다.
- 노트 ID 목록이 실제 접근 가능한 학생/강의 범위인지 생성 전에 명확하게 검증하는 흐름이 보이지 않는다.

**영향:** AI API 변경, 프롬프트 변경, 저장 구조 변경을 독립적으로 진행하기 어렵고 장애 원인 추적이 어렵다.

### 4.8 설정 및 환경 의존성

**대상:** `backend/src/main/resources/application.yaml`, `SecurityConfig.java`, `NotionEditor.jsx`, `api/client.js`

- DB 비밀번호와 JWT secret이 설정 파일에 직접 들어 있다.
- 프론트엔드와 에디터에 `http://localhost:8080` 및 `http://localhost:5173`이 직접 지정돼 있다.
- `ddl-auto: update`, `show-sql: true`가 환경 구분 없이 적용돼 있다.

**영향:** 개발/운영 환경 분리가 어렵고 배포 시 설정 변경 누락 가능성이 크다. 특히 민감 정보는 환경 변수 또는 별도 비공개 설정으로 분리해야 한다.

### 4.9 테스트 부족

**대상:** `backend/src/test/java/.../BackendApplicationTests.java`, `frontend/src`

- 백엔드 테스트는 Application context 로딩 테스트 1개(9줄)뿐이다.
- 인증, 수강 권한, 노트 트리, 게시글 작성자 검증, 퀴즈 저장/조회, AI 응답 파싱에 대한 단위/통합 테스트가 없다.
- 프론트엔드에도 자동화 테스트 파일이 없다.

**영향:** 기능 보존을 전제로 리팩터링할 때 회귀를 검출할 안전망이 없다.

## 5. 리팩터링 우선순위가 높은 파일

우선순위는 영향 범위, 변경 난이도, 보안/데이터 손상 위험, 중복 제거 효과를 기준으로 선정했다.

| 우선순위 | 파일 | 우선 사유 | 권장 방향 |
|---|---|---|---|
| P0 | `backend/src/main/java/com/uninote/backend/service/QuizService.java` | 가장 큰 서비스(375줄), 외부 AI·파일·JSON·DB를 모두 담당, 변환 중복과 광범위 예외 처리 | AI client/prompt builder, Tiptap content parser, Question mapper, quiz persistence service로 분리 |
| P0 | `frontend/src/components/editor/NotionEditor.jsx` | 프론트 최대 파일(555줄), 저장/복구/업로드/에디터/퀴즈 결합 | `useNoteAutosave`, `useFileUpload`, slash command factory, editor extensions/config, source navigation으로 분리 |
| P0 | `frontend/src/pages/CourseDetailPage.jsx` | 노트와 커뮤니티의 모든 상태·CRUD 집중(554줄) | NoteSidebar, CommunityPanel, PostDetail/CommentList, `useCourseNotes`, `useCoursePosts`로 분리 |
| P0 | `backend/src/main/resources/application.yaml` | DB 자격 증명/JWT secret/환경 설정이 코드 저장소에 존재 | 환경 변수와 profile별 설정으로 분리하고 운영 기본값 제거 |
| P1 | `backend/src/main/java/com/uninote/backend/service/PostService.java` | 응답 변환과 익명 정책이 DashboardService와 중복, 권한 검증 분산 | 공통 mapper/anonymous identity policy와 course access policy 도입 |
| P1 | `backend/src/main/java/com/uninote/backend/service/NoteService.java` | 노트 소유권/수강 검증과 트리 변환이 섞이고 메서드별 검증 일관성이 낮음 | 접근 검증 helper/policy와 DTO mapper 분리, 모든 read/write 경로 검증 통일 |
| P1 | `backend/src/main/java/com/uninote/backend/controller/QuizController.java` | 학생 조회 boilerplate 반복, 서비스 호출 전에 인증 변환 수행 | 인증 주체 resolver 또는 custom principal 사용 |
| P1 | `backend/src/main/java/com/uninote/backend/service/IncorrectNoteService.java` | 권한 예외 타입과 QuizService 내부 mapper 의존 | 공통 authorization exception 및 Question mapper 사용 |
| P1 | `frontend/src/pages/QuizLibraryPage.jsx` | 탭별 데이터 fetching, 모달, 풀이 상태, 삭제를 한 페이지가 담당(290줄) | 탭별 hook/component와 quiz API module 분리 |
| P2 | `backend/src/main/java/com/uninote/backend/controller/ImageUploadController.java` | 저장/검증/다운로드 응답을 Controller가 직접 처리(92줄) | 파일 저장 서비스와 upload policy 분리, MIME/경로 검증 중앙화 |
| P2 | `frontend/src/api/client.js` 및 `NotionEditor.jsx` | API base URL과 서버 URL이 여러 곳에 하드코딩 | 단일 runtime config와 upload API 함수 사용 |
| P2 | `backend/src/main/java/com/uninote/backend/exception/GlobalExceptionHandler.java` | `IllegalArgumentException`을 일괄 401로 매핑 | NotFound/Forbidden/Validation 예외를 구분하고 상태 코드 표준화 |
| P2 | `backend/src/test/java/com/uninote/backend/BackendApplicationTests.java` 및 신규 테스트 영역 | 리팩터링 회귀 안전망 부재 | 권한·mapper·서비스 핵심 경로부터 테스트 추가 |

## 6. 단계별 실행 순서

### 1단계: 안전망과 설정 분리

- DB/JWT/Gemini/base URL을 환경별 설정으로 이동
- 예외 타입과 HTTP 상태 매핑을 명확히 구분
- 인증, 수강 권한, 노트 저장, 게시글 작성자, 퀴즈 저장에 대한 백엔드 테스트 추가
- 현재 API 응답 JSON을 기준으로 계약을 고정

### 2단계: 공통 정책과 매핑 정리

- Question -> QuestionResponse mapper 통합
- Post/Comment 익명 표시명과 본인 여부 정책 통합
- 현재 `studentNum` 문자열 기반 principal을 명시적인 인증 주체 타입으로 정리
- Course access 검증을 모든 Note/Post/Quiz 경로에 일관되게 적용

### 3단계: 백엔드 서비스 분리

- `QuizService`를 AI 요청, 콘텐츠 추출, 응답 검증, 퀴즈 저장/조회로 분리
- 파일 업로드/다운로드를 별도 서비스로 이동
- Controller에서 반복되는 Student 조회 제거
- 트랜잭션 경계를 유스케이스 단위로 재검토

### 4단계: 프론트엔드 페이지 분리

- `CourseDetailPage`에서 노트와 커뮤니티를 분리
- `NotionEditor`의 자동 저장, 파일 업로드, slash command, 출처 이동을 hook/module로 분리
- `QuizLibraryPage`의 탭별 fetch와 모달을 컴포넌트/훅으로 분리
- API 호출을 기능별 모듈로 이동해 페이지에서 URL 문자열을 직접 조합하지 않도록 개선

### 5단계: 문서와 구조 정합성 정리

- 실제 현재 구조와 불일치하는 `docs/디렉토리구조.md`의 예시(`App.js`, `index.js`, 미존재 폴더 등) 갱신
- REST API 문서와 실제 Controller 경로/응답을 대조
- `docs/architecture.md`에 현재 AI/오답노트/파일 업로드 흐름 추가
- 날짜별 진행 문서와 기준 설계 문서를 구분해 최신 문서 위치를 명확히 함

## 7. 기능 보존을 위한 리팩터링 기준

- API 경로와 성공 응답 필드명은 명시적인 변경 계획 없이 유지한다.
- Tiptap JSON의 첫 heading, `BlockId`, `PageLink`, `PdfBlock`, `sourceNoteId`, `sourceBlockId` 계약을 보존한다.
- 노트 자동 저장의 debounce 및 localStorage 복구 우선순위를 테스트로 고정한다.
- 익명 게시글/댓글 표시 규칙과 본인 여부 동작을 화면 간 동일하게 유지한다.
- 퀴즈 생성 후 `QuizSet -> Question`, 풀이 후 `QuizAttempt -> UserAnswer`, 오답노트 그룹 연결을 보존한다.
- 단계별 변경 전후에 백엔드 테스트, 프론트 lint/build, 주요 수동 시나리오를 실행한다.

## 8. 결론

현재 구조는 기능별 Controller-Service-Repository 계층과 React 페이지/컴포넌트 구분이 있어 기능을 추적할 수 있는 상태다. 다만 기능이 확장된 과정에서 `QuizService`, `NotionEditor`, `CourseDetailPage`에 여러 책임이 누적됐고, 인증/권한·응답 변환·익명 표시 정책이 반복 구현됐다.

가장 안전한 순서는 **설정/보안과 테스트 안전망 확보 -> 공통 정책/매퍼 통합 -> 대형 서비스 분리 -> 대형 React 화면 분리**다. 먼저 P0 항목을 처리해야 이후 리팩터링에서 AI 출처 추적, 자동 저장, 커뮤니티 권한, 학습 이력이라는 핵심 기능을 보존하면서 변경할 수 있다.
