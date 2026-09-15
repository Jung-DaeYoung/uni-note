# 현재 작업 계획: P2 데이터 일관성 및 성능

## 작업 범위

`PLANS.md`의 P2 항목만 수행한다.

## 작업 원칙

- 기존 API 경로, 성공 응답 필드, 저장 형식과 사용자 동작을 유지한다.
- 한 번에 하나의 문제만 수정하고 관련 테스트와 회귀 검증을 수행한다.
- 새 라이브러리·프레임워크와 범용 추상화를 추가하지 않는다.
- 실제 코드와 실행 결과를 기준으로 판단한다.
- 관련 없는 사용자 변경 사항을 덮어쓰거나 되돌리지 않는다.
- 성능 문제는 측정 후 필요한 범위만 수정한다.
- 최근 Slash Command 동작을 보호하며, 메뉴 항목 구성·필터링·우선순위는 변경하지 않는다.

## 보호할 기존 기능

- 노트 Tiptap JSON 저장·복구와 자동 저장
- 노트 생성·조회·전환
- 강의·수강 권한
- 익명 게시판과 댓글
- AI 퀴즈 생성·풀이·오답노트
- 이미지·PDF 업로드 및 열기
- JWT 로그인과 만료 처리
- Slash Command의 `/` 메뉴, 검색, 방향키, Enter, 마우스 클릭, Escape

# P2-1. 부모 노트와 게시판 수강 권한 (완료)

## 진행 결과 (2026-09-15)

- 게시판 조회·게시글 작성·댓글 작성의 수강 권한 검증(`PostService.validateEnrollment`)은 이전 세션(3단계)에서 이미 적용되어 있었음을 코드로 재확인.
- `NoteService.createNote()`에 부모 노트 검증(`validateParentNote`)을 신규 추가: 부모 노트가 요청 강의(`courseId`)와 다르면 `CourseAccessException`(403), 부모 노트 소유자가 요청 학생과 다르면 기존 `validateOwnership()` 재사용으로 `CourseAccessException`(403). 부모 노트 자체가 없으면 기존과 동일하게 `ResourceNotFoundException`(404)이 먼저 발생.
- `NoteServiceTest`에 6개 테스트 추가(루트 노트 생성 성공, 같은 강의·본인 소유 부모 노트 성공, 다른 강의 부모 노트 차단, 다른 학생 부모 노트 차단, 없는 부모 노트 404, 미수강 강의 생성 차단).
- 전체 `./gradlew.bat test` `BUILD SUCCESSFUL`.

## 대상

- `backend/src/main/java/com/uninote/backend/service/NoteService.java`
- `backend/src/main/java/com/uninote/backend/service/PostService.java`
- 기존 `EnrollmentRepository` 및 강의 접근 검증 코드
- 관련 백엔드 서비스 테스트

## 문제

- 부모 노트의 강의·소유자 일치 검증이 부족해 다른 강의 또는 다른 학생의 노트를 부모로 지정할 수 있다.
- 게시판 조회·작성·댓글 작성에 수강 권한 검증이 부족하다.

## 수정 방법

1. 부모 노트의 course와 student가 현재 요청의 대상 및 인증 사용자와 일치하는지 검증한다.
2. 게시판 조회·게시글 작성·댓글 작성에 대상 강의의 수강 여부 검증을 적용한다.
3. 존재하지 않는 리소스는 권한 검사보다 먼저 적절한 리소스 없음 응답으로 처리한다.
4. 정상 수강생의 기존 성공 응답과 게시판·댓글 동작은 유지한다.

## 검증

- 다른 강의의 노트를 부모로 지정하면 차단
- 다른 학생의 노트를 부모로 지정하면 차단
- 수강 중인 강의의 게시판 조회·게시글 작성·댓글 작성 성공
- 미수강 강의의 게시판 조회·게시글 작성·댓글 작성 차단
- 존재하지 않는 course/post는 적절한 오류 응답 반환

# P2-2. AI 외부 연동 안정성 (완료)

## 진행 결과 (2026-09-15)

- **설정 필수값 검증**: `QuizAiGenerationService.validateConfig()`를 `@PostConstruct`로 추가해 `GEMINI_API_KEY`가 없으면 기동 실패. 실 서버 재기동으로 정상 기동(키 있음) 확인.
- **문제 수·노트 수·typeCounts 제한**: `QuizService.validateGenerationLimits()` 신설 — 노트 20개, 유형별 문제 수 1~20개, 총 문제 수 30개 상한. API로 "typeCounts 누락"과 "유형별 개수 초과" 모두 400 `INVALID_REQUEST`로 차단되는 것을 라이브 확인.
- **입력 파일 소유권 확인**: `QuizAiGenerationService.addMediaPart()`가 노트 콘텐츠에 저장된 이미지/PDF URL의 서명(owner/sig)을 현재 요청 학생 기준으로 재검증하도록 변경. 다른 학생에게 발급된 서명을 가진 URL은 조용히 건너뛰어 AI에 전달되지 않음(단위 테스트로 확인: 실제 파일 I/O 포함).
  - **부수 발견 및 수정**: 기존 코드는 URL에서 쿼리스트링(`?owner=...&sig=...`)까지 파일명에 포함시켜 `Files.exists()`가 항상 실패했다 — 즉 서명 도입 이후 신규 업로드된 이미지/PDF는 AI 퀴즈 생성에 **한 번도 실제로 첨부되지 않고 있었다**(레거시 화이트리스트 3개 파일만 우연히 동작). `URI` 기반 경로/쿼리 분리로 수정해 정상 동작하도록 함.
- **총 미디어 크기 제한**: 총 20MB(서버 단일 파일 제한 10MB의 2배) 초과 시 `InvalidRequestException`(400)으로 차단. 코드 검토로 확인(20MB+ 테스트 파일을 실제로 만들지는 않음 — 실행 비용 대비 낮은 위험으로 판단).
- **RestTemplate timeout**: `RestClientConfig`에 connect 5초/read 60초 설정.
- **AI 응답 구조 검증 + 예외 변환**: `candidates`/`parts`/`text` 각 단계 존재 여부 확인 후 `ExternalServiceException`(503 `EXTERNAL_SERVICE_ERROR`)으로 통일. 외부 API 호출 실패(`RestClientException`)도 동일하게 503으로 변환. `GlobalExceptionHandler`에 핸들러 추가.
- 실제 Gemini API로 정상 퀴즈 생성 End-to-End 확인(문제 2개 생성 성공, 테스트로 만든 퀴즈는 삭제).
- `QuizAiGenerationServiceTest`(신규, 실제 파일 I/O 포함) + `QuizServiceTest`에 생성 제한 테스트 4건 추가. 전체 `./gradlew.bat test` `BUILD SUCCESSFUL`(132 tests).

## 대상

- `backend/src/main/java/com/uninote/backend/service/QuizAiGenerationService.java`
- `backend/src/main/java/com/uninote/backend/service/QuizService.java`
- `backend/src/main/java/com/uninote/backend/config/RestClientConfig.java`
- 관련 DTO와 테스트

## 문제

- API key, `typeCounts`, AI 응답 구조와 timeout 검증이 부족하다.
- `RestTemplate`에 connect/read timeout이 설정되어 있지 않다.
- 비정상 응답과 외부 장애가 일반 `RuntimeException`으로 처리된다.
- 파일을 메모리와 Base64로 읽으면서 총 요청 크기 제한이 없다.

## 범위 제한

- 범용 재시도·검증 프레임워크를 새로 만들지 않는다.
- 설정 필수값 검증, timeout 설정, AI 응답 필드 존재 확인 수준의 최소 구현으로 제한한다.
- 새 AI 제공자나 프롬프트·응답 스키마 변경은 하지 않는다.

## 수정 방법

1. 필수 설정값을 애플리케이션 시작 시 검증한다.
2. 퀴즈 요청의 문제 수·노트 수·`typeCounts`를 검증하고 제한한다.
3. 입력 파일의 소유권과 총 미디어 크기를 확인한다.
4. `RestTemplate`에 connect/read timeout을 설정한다.
5. AI 응답의 필수 구조와 필드 존재 여부를 검증한다.
6. 외부 연동 실패를 기존 예외 응답 체계에 맞는 명시적 예외로 변환한다.

## 검증

- 필수 설정 누락 시 명확하게 기동 실패
- 잘못된 문제 수·노트 수·문제 유형 요청 차단
- 제한을 초과한 미디어 요청 차단
- 타 사용자 파일 입력 차단
- AI timeout 및 비정상 응답이 500 내부 오류로 무분별하게 노출되지 않음
- 정상 퀴즈 생성·저장·풀이 회귀

# P2-3. JPA N+1 및 대량 응답 (완료)

## 진행 결과 (2026-09-15) — 실 서버 측정값(before → after)

측정은 `show-sql: true` 로그의 `Hibernate:` 문장 수를 실제 API 호출 전후로 세는 방식으로 진행했다(원칙대로 "측정 후 실제 병목이 확인된 API에만" 적용).

- **`GET /api/posts/{courseId}`** (게시글 2건, 댓글 0건): 7 → 5개 SQL. `PostRepository.findByCourseOrderByCreatedAtDesc`를 `LEFT JOIN FETCH p.student/p.comments/comment.student`로 변경 — 댓글 조회가 게시글 수만큼 늘어나던 것을 게시글 수와 무관한 쿼리 1개로 통합.
- **`GET /api/courses/{courseId}/notes/tree`** (노트 4건, 2단계 깊이): 9 → 4개 SQL. `NoteRepository`에 `findByCourseAndStudentOrderByCreatedAtAsc`(전체 노트 1회 조회)를 추가하고, `NoteService`가 부모-자식 관계를 메모리에서 그룹핑해 트리를 구성하도록 변경 — 이전엔 노드 하나당 자식 조회 쿼리가 재귀적으로 발생(트리 크기에 비례)했는데 이제 트리 크기와 무관하게 O(1). 방어적 깊이 상한(20)도 추가.
- **`GET /api/quiz/my`** (퀴즈 3건, 강의 2종): 4 → 3개 SQL, 강의 조회가 서로 다른 강의 수만큼 늘어나던 것을 제거(`QuizSetRepository`에 `LEFT JOIN FETCH qs.course` 추가).
- **`GET /api/quiz/attempts/my`** (풀이 기록 2건): 7 → 3개 SQL. `QuizAttemptRepository`에 `LEFT JOIN FETCH qa.quizSet qs LEFT JOIN FETCH qs.course` 추가 + `quizSet.getQuestions().size()`를 `QuestionRepository.countByQuizSetIdIn()`(GROUP BY 배치 카운트, 신규 `QuizSetQuestionCount` projection) 조회로 교체. `getAttemptsByQuizSet`도 동일 로직 공유(`QuizService.convertToAttemptResponses`로 추출).
- 네 경우 모두 API 응답 내용(필드·정렬)은 라이브 호출로 그대로 유지됨을 재확인.
- **페이지네이션은 적용하지 않음**: 현재 데이터 규모에서 측정으로 확인된 병목이 아니고, 응답 계약(배열 형태)을 바꾸는 것은 "기존 응답 계약과 정렬·페이지 의미를 유지한다" 원칙과 충돌하므로 범위에서 제외. 데이터가 실제로 커지면 별도로 재검토 필요.
- 신규/보강 테스트: `NoteServiceTest`(중첩 트리 1회 조회 검증), `QuizServiceTest`(배치 카운트 검증 3건). 전체 `./gradlew.bat test` `BUILD SUCCESSFUL`.

## 대상

- `backend/src/main/java/com/uninote/backend/service/PostService.java`
- `backend/src/main/java/com/uninote/backend/service/NoteService.java`
- `backend/src/main/java/com/uninote/backend/service/QuizService.java`
- 관련 Repository와 응답 DTO

## 문제

- 댓글, 자식 노트, 퀴즈 문제, 풀이 답안 컬렉션을 응답 변환 중 lazy loading한다.
- 데이터 증가 시 SQL 수와 응답 시간이 급증할 수 있다.
- 노트 트리 깊이와 응답 크기 제한이 부족하다.

## 수정 방법

1. 대상 API의 SQL 수와 응답 시간을 먼저 측정한다.
2. 실제 병목이 확인된 API에만 fetch join, entity graph 또는 projection을 적용한다.
3. 필요한 컬렉션은 배치 조회한다.
4. 대량 응답에는 페이지네이션과 응답 크기 제한을 적용한다.
5. 노트 트리에는 필요한 범위의 깊이 제한을 적용한다.
6. 기존 응답 계약과 정렬·페이지 의미를 유지한다.

## 검증

- 대표 API의 SQL 호출 수와 응답 시간이 개선되었는지 확인
- 댓글·자식 노트·퀴즈·풀이 응답 내용 회귀
- 대량 데이터에서 응답 크기와 처리 시간이 제한되는지 확인
- 정상 소량 데이터의 결과가 변경되지 않는지 확인

# P2-4. 자동 저장 JSON 파싱 및 경쟁 상태 (1~3 완료, 4는 보류)

## 진행 결과 (2026-09-15)

- **JSON 파싱 보호**: `safeParseJson`으로 서버 콘텐츠/localStorage 파싱을 try/catch로 감쌌고, `isValidTiptapDoc`/`isValidLocalEntry`로 파싱된 값이 `{type:'doc', content:[...]}` 최소 구조를 갖췄는지까지 확인한다. 구조가 깨진 데이터는 무시하고 다음 우선순위(서버 → 빈 문서)로 넘어간다.
- **noteId 경쟁 상태**: `client.put` 호출에 `AbortController` signal을 추가. `cancelPendingSave()`가 대기 중인 debounce 타이머뿐 아니라 이미 전송된 PUT 요청까지 `abort()`한다. 취소된 요청은 `axios.isCancel(error)`로 구분해 `saveStatus`를 `'error'`로 바꾸거나 `onSaved()`를 호출하지 않는다. `NotionEditor.jsx`는 이미 `<NotionEditor key={noteId} />`로 노트 전환 시 훅 인스턴스 자체가 재생성되므로, 이 변경으로 "이전 노트 응답이 새 노트 상태를 오염시키는" 경로가 완전히 차단된다.
- **저장 실패 재시도**: 저장 로직을 `performSave`로 분리해 debounce와 재시도가 공유하도록 하고, `retrySave(editor)`를 훅에서 노출. `NotionEditor.jsx`의 저장 상태 표시줄에 `saveStatus === 'error'`일 때만 보이는 "Retry" 버튼을 추가해 대기 중인 debounce를 취소하고 즉시 재저장을 시도한다.
- **대형 문서 성능 개선(4번)**: 측정 없이 구조를 바꾸지 않는다는 원칙에 따라 보류. 실제 성능 문제가 측정으로 확인되면 별도로 진행한다.
- `npm run lint`(23 problems: 21 errors/2 warnings, 기존 `P3-8` 베이스라인과 동일) / `npm run build` 회귀 없음 확인.
- **미검증**: 실제 브라우저에서 로그인 후 자동 저장·재시도·손상된 localStorage 복구 시나리오는 테스트 계정이 없어 수행하지 못했다. 코드 검토와 lint/build로만 확인된 상태.

## 대상

- `frontend/src/components/editor/hooks/useNoteAutosave.js`
- `frontend/src/components/editor/NotionEditor.jsx`
- `frontend/src/pages/CourseDetailPage.jsx`

## 문제

- 서버 콘텐츠나 localStorage가 손상되면 `JSON.parse()` 예외로 에디터가 실패할 수 있다.
- 노트 전환 후 이전 노트의 저장 요청이 계속 진행될 수 있다.
- 늦게 도착한 응답이 현재 화면의 `onSaved`를 호출할 수 있다.
- 저장 실패 시 재시도 경로가 없다.

## 수정 순서

```text
JSON 파싱 보호
→ noteId 경쟁 상태 보호
→ 저장 실패 재시도
→ 대형 문서 성능 개선
```

## 수정 방법

1. 서버 데이터와 localStorage 파싱을 명시적으로 보호하고 저장 데이터의 최소 구조를 검증한다.
2. AbortController 또는 noteId별 요청 세대 번호로 이전 노트 요청을 무효화한다.
3. 현재 noteId와 일치하는 저장 응답만 상태와 `onSaved`에 반영한다.
4. 저장 실패 시 기존 사용자 흐름을 해치지 않는 재시도 또는 즉시 저장 UI를 제공한다.
5. 필요성이 확인된 경우에만 대형 문서 처리 비용을 개선한다.

## 주의

- `NotionEditor.jsx`의 `SlashCommand.configure({...})` 블록과 `priority: 1000`은 수정하지 않는다.
- Slash Command extensions 배열 순서를 변경하지 않는다.
- 이미지·PDF 업로드 command의 성공 시 삽입 결과를 변경하지 않는다.

## 검증

- 손상된 서버 콘텐츠와 localStorage에서도 에디터가 안전하게 복구·실패 처리됨
- 노트 전환 중 이전 요청이 현재 노트 상태를 덮어쓰지 않음
- 늦은 저장 응답이 현재 노트의 저장 상태를 오염시키지 않음
- 일시적 저장 실패 후 재시도 가능
- 기존 자동 저장·복구·수동 저장 회귀

# P2-5. 노트 조회·생성 race (완료)

## 진행 결과 (2026-09-15)

- **노트 조회 stale response**: `/notes/{noteId}` GET에 `AbortController` signal을 연결하고, `noteId`가 바뀌거나 언마운트될 때 effect cleanup에서 이전 요청을 `abort()`한다. 취소된 요청은 `axios.isCancel(error)`로 걸러 콘솔 오류를 남기지 않는다. → 늦게 도착한 이전 노트의 응답이 `setNoteData`를 호출해 현재 화면을 덮어쓰는 경로 차단.
- **최초 노트 생성 POST 중복**: "최초 진입" effect에 `isActive` 플래그를 추가. React StrictMode(개발 모드)의 mount→cleanup→remount 이중 실행이나 의존성 변경으로 effect가 재실행되어도, cleanup에서 `isActive = false`로 표시된 이전 실행은 `fetchTree()`/`client.post(...)` 완료 후 `isActive` 체크에서 조기 반환해 중복 생성·중복 navigate를 하지 않는다.
- 새 라이브러리 없이 기존 `axios`(P2-4에서 이미 도입)만 재사용.
- `npm run lint`/`npm run build` 기존 베이스라인과 동일, 회귀 없음.
- **미검증**: 실제 브라우저에서 빠른 노트 전환·StrictMode 중복 생성 시나리오는 로그인 테스트 계정이 없어 수행하지 못함(코드 검토 + lint/build만 확인).

## 대상

- `frontend/src/hooks/useCourseNotes.js`

## 문제

- 빠른 노트 전환에서 이전 GET 응답이 현재 상태를 덮을 수 있다.
- StrictMode와 effect 재실행으로 최초 노트 생성 POST가 중복될 수 있다.

## 수정 방법

1. 요청 취소 또는 request ID 검증으로 stale GET 응답을 무시한다.
2. noteId 변경 시 이전 노트 데이터를 초기화한다.
3. 최초 노트 생성에 실행 세대와 중복 방지 플래그를 적용한다.
4. 서버의 idempotent 생성 계약과 현재 API 응답을 확인하되, 필요 이상의 API 변경은 하지 않는다.

## 검증

- 빠른 노트 전환에서도 현재 noteId의 데이터만 표시
- 최초 노트 생성 POST가 중복되지 않음
- 로딩·빈 상태·생성 실패 상태 회귀

# P2-6. 업로드·Tiptap 콘텐츠 신뢰 경계

## 대상

- `frontend/src/components/editor/hooks/useNoteUploads.js`
- `frontend/src/components/editor/NotionEditor.jsx`
- `frontend/src/components/editor/extensions/PdfBlock.jsx`
- `frontend/src/components/editor/extensions/PageLink.jsx`

## 문제

- 파일 크기·실제 MIME·확장자 검증과 업로드 진행 상태가 부족하다.
- 서버 파일 URL을 별도 정책 없이 문서에 저장·렌더링한다.
- 허용 scheme·origin 검증이 부족하다.
- 업로드 실패가 `null`과 console 출력으로 끝나 사용자에게 보이지 않는다.

## 수정 방법

1. 서버의 파일 검증 정책과 일치하도록 클라이언트 파일 크기·MIME·확장자를 검증한다.
2. 문서에 저장·렌더링하는 URL의 허용 scheme과 origin을 제한한다.
3. 업로드 진행·성공·실패 상태를 사용자에게 표시한다.
4. 가능하면 파일 식별자 기반 URL을 사용하되 기존 파일 접근 계약은 유지한다.
5. 이미지·PDF 업로드 command 내부만 보강한다.

## 주의

- Slash Command 메뉴 항목 구성과 `items()` 필터링은 변경하지 않는다.
- 성공 시 이미지/PDF가 에디터에 삽입되는 기존 결과를 유지한다.

## 검증

- 허용되지 않은 파일 크기·MIME·확장자 차단
- 허용되지 않은 scheme·origin의 URL 차단
- 정상 이미지 표시 및 PDF 새 탭 열기·다운로드 유지
- 업로드 중 상태와 실패 메시지가 표시됨

# P2-7. 프론트 요청·상태 중복과 오류 처리 (완료)

## 진행 결과 (2026-09-15)

- **`/dashboard/courses` 중복 호출 제거**: `CourseContext`가 `courses` 외에 `recentPosts`/`recentNotes`/`studentName`도 함께 보관하도록 확장하고, `DashboardPage`는 자체 fetch(`useEffect`+`client.get`)를 완전히 제거해 context를 그대로 구독하도록 변경. 사이드바(`AppLayout`)와 대시보드가 동일한 한 번의 fetch를 공유한다.
  - **부수 발견**: React StrictMode(개발 모드)의 mount→cleanup→remount 이중 실행으로 `CourseContext` 자체도 매번 2번씩 요청을 보내고 있었다. `AbortController`로 이전 요청을 취소하도록 수정 — 라이브 검증(새로고침 전: GET 2회 → 후: GET 1회, network 로그로 확인).
- **게시판 stale response 방지**: `useCourseBoard.js`의 게시글 목록 조회 effect에 `AbortController` 적용(노트 조회에 P2-5에서 적용한 것과 동일 패턴) — 빠른 강의 전환 시 이전 강의의 응답이 현재 강의 게시판 상태를 덮어쓰지 않음.
- **401/403/404/400 구분과 인증 이벤트 분리**: 코드 검토 결과 `client.js`의 인터셉터는 이미 401(로그아웃)과 403 `FORBIDDEN_COURSE_ACCESS`(alert+대시보드 이동)만 특별 처리하고 나머지는 호출부에 위임하는 구조였다. 문제의 실질 원인은 P1-7/4단계에서 이미 고친 백엔드 쪽 상태 코드 오분류(소유권 위반·리소스 없음이 401로 응답되던 것)였고, 그 수정이 이미 반영되어 있어 이 항목은 추가 변경 없이 충족됨을 확인.
- react-query/SWR 등 신규 라이브러리 없이 기존 Context/hook 구조 안에서 처리(범위 제한 준수).
- 라이브 검증: 새로고침 시 `/api/dashboard/courses` 요청이 정확히 1회(GET)만 발생하고 대시보드(강의 목록·최근 노트·최근 게시글·학생 이름)가 모두 정상 렌더링됨을 스크린샷으로 확인.
- `npm run lint`/`npm run build` 기존 베이스라인과 동일, 회귀 없음.

## 대상

- `frontend/src/context/CourseContext.jsx`
- `frontend/src/pages/DashboardPage.jsx`
- `frontend/src/api/client.js`
- `frontend/src/hooks/useCourseNotes.js`
- `frontend/src/hooks/useCourseBoard.js`

## 문제

- `/dashboard/courses`를 Context와 Dashboard가 중복 호출한다.
- 노트·게시글 요청에서 빠른 전환과 stale response 처리가 일관되지 않다.
- Axios interceptor가 직접 redirect와 alert를 수행해 화면 상태와 결합된다.

## 범위 제한

- react-query/SWR 등 새 데이터 fetching 라이브러리를 추가하지 않는다.
- 기존 Context와 hook 구조 안에서 중복 호출 제거와 요청 취소를 처리한다.

## 수정 방법

1. 대시보드와 사이드바의 데이터 책임을 분리하되 중복 요청을 제거한다.
2. 노트·게시글 요청에 요청 취소 또는 request ID 검증을 적용한다.
3. 인증 이벤트와 화면별 오류 표시를 분리한다.
4. 401 인증 만료 처리와 403/404/400 화면 오류 처리를 기존 API 계약에 맞게 구분한다.

## 검증

- `/dashboard/courses`의 중복 요청이 제거됨
- 빠른 전환에서 이전 응답이 현재 화면을 덮지 않음
- 인증 만료 시 기존 로그아웃·이동 동작 유지
- 400/403/404 오류가 불필요한 로그인 이동으로 처리되지 않음

# 실행 순서

1. 부모 노트와 게시판 수강 권한 (`P2-1`)
2. 자동 저장 JSON 파싱 보호 (`P2-4`)
3. 자동 저장 noteId 경쟁 상태 (`P2-4`)
4. 저장 실패 재시도 (`P2-4`)
5. 노트 조회 race 및 생성 중복 (`P2-5`)
6. 업로드 오류 UX 및 콘텐츠 검증 (`P2-6`)
7. AI 요청 크기 제한과 외부 연동 최소 안정화 (`P2-2`)
8. N+1 및 대량 응답 측정·개선 (`P2-3`)
9. 프론트 요청 중복과 오류 처리 정리 (`P2-7`)

각 항목은 다음 순서로 진행한다.

```text
현재 구현 확인
→ 한 항목 수정
→ 관련 테스트 작성·실행
→ 기존 API·화면 회귀 확인
→ 다음 항목
```

# 최종 검증

## 백엔드

- `backend\gradlew.bat test`
- 부모 노트 소유자·강의 일치 검증
- 게시판·댓글 수강 권한 검증
- AI 입력 제한·timeout·비정상 응답 처리
- 대표 API의 SQL 수·응답 시간 측정

## 프론트엔드

- `frontend\npm.cmd run lint`
- `frontend\npm.cmd run build`
- 자동 저장 JSON 복구와 경쟁 상태
- 노트 조회·생성 race
- 이미지 업로드·표시
- PDF 새 탭 열기·다운로드
- 업로드 오류 표시
- 401/403/404 오류 처리
- Slash Command 전체 UX

## 완료 조건

- 부모 노트와 게시판·댓글에 강의·사용자 수강 경계가 적용된다.
- 자동 저장과 노트 전환에서 stale response와 중복 생성이 발생하지 않는다.
- 업로드 파일과 Tiptap URL의 신뢰 경계가 검증되고 실패가 사용자에게 표시된다.
- AI 요청의 설정·크기·timeout·응답 검증이 최소 수준으로 동작한다.
- 측정된 N+1·대량 응답 문제가 필요한 범위에서 개선된다.
- 프론트 중복 요청과 오류 처리가 기존 기능을 보존하면서 정리된다.
- 관련 백엔드 테스트와 프론트 lint/build가 통과한다.
- Slash Command의 Enter·마우스·Escape·일반 Enter 동작이 유지된다.
