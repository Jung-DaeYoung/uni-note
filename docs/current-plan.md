# 다음 작업 계획

## 목표

현재 코드 간소화 작업 이후 남은 인증·라우팅·API 계약·파일 보안·테스트 공백을 보완한다. 기존 기능과 API 계약을 우선 보존하며, 실제 회귀 위험과 보안 영향이 큰 항목부터 진행한다.

## 1순위: 인증·라우팅 회귀 방지

### 1-1. AuthContext 로그인 토큰 검증

대상:

- `frontend/src/context/AuthContext.jsx`
- `frontend/src/context/AuthContext.test.jsx`

현재 초기화와 `storage` 이벤트에서는 `isTokenValid()`를 호출하지만 `login(newToken)`은 토큰을 검증하지 않고 저장한다.

```javascript
const login = useCallback((newToken) => {
  localStorage.setItem('token', newToken);
  setToken(newToken);
}, []);
```

반면 코드 주석은 모든 token이 검증을 통과한다고 설명한다.

작업:

- `login()`에서 `isTokenValid(newToken)`을 확인한다.
- malformed JWT와 만료 JWT는 저장하지 않는다.
- 유효하지 않은 토큰으로 인증 상태가 true가 되지 않도록 한다.
- 정상 로그인, 로그아웃, 만료 토큰, 다중 탭 동기화를 유지한다.

근거:

- `frontend/src/context/AuthContext.jsx:29-40`
- 현재 AuthContext 테스트에는 `login()` 입력 토큰 검증 케이스가 없다.

### 1-2. ProtectedRoute 라우팅 회귀 테스트

대상:

- `frontend/src/App.jsx`
- `frontend/src/routes/ProtectedRoute.jsx`

현재 중첩 라우트와 `Outlet` 방식으로 보호 라우트를 단순화했다. 구조는 정상적이지만 라우터 테스트가 없다.

테스트:

- 비로그인 사용자의 `/dashboard` 접근은 `/login`으로 이동
- 인증 사용자의 `/dashboard` 접근은 Dashboard 표시
- `/course/:courseId` 직접 접근
- `/course/:courseId/note/:noteId` 직접 접근
- `/quizzes` 직접 접근
- 인증 상태에서 `/login` 접근 시 `/dashboard` 이동

근거:

- 보호 라우트 변경은 여러 화면의 접근 제어에 동시에 영향을 준다.
- 현재 Frontend 테스트는 AuthContext, SuggestionList, Autosave에 집중되어 있다.

## 2순위: HTTP 계약과 Validation 보완

### 2-1. DTO Validation 범위 확장

대상:

- `backend/src/main/java/com/uninote/backend/dto`
- `backend/src/main/java/com/uninote/backend/controller`
- `backend/src/main/java/com/uninote/backend/service/IncorrectNoteService.java`

현재 적용된 Validation은 주로 `@NotBlank`, `@NotNull`, `@NotEmpty`, 일부 `@Size(max = 200)`이다. ID와 숫자 범위, 본문 길이 제약은 충분하지 않다.

검토 대상:

- PathVariable ID의 양수 검증
- `review-today.limit`의 최소·최대 범위
- `QuizRequest.noteIds` 내부 ID 검증
- `QuizRequest.typeCounts` 값의 음수·상한 검증
- 게시글·댓글·노트 본문 최대 길이
- `previewText`, `searchContent` 길이 제한

주의:

- 노트 본문에 무조건 `@NotBlank`를 적용하면 빈 노트 저장 계약을 깨뜨릴 수 있다.
- 프론트가 실제로 보내는 빈 노트 JSON과 저장 흐름을 먼저 확인한다.

근거:

- `backend/src/main/java/com/uninote/backend/dto/NoteRequest.java`
- `backend/src/main/java/com/uninote/backend/dto/QuizRequest.java`
- `backend/src/main/java/com/uninote/backend/dto/QuizAttemptRequest.java`
- `backend/src/main/java/com/uninote/backend/controller/IncorrectNoteController.java:79-84`
- `backend/src/main/java/com/uninote/backend/service/IncorrectNoteService.java:214-222`

### 2-2. 실제 `@WebMvcTest` 기반 Validation 테스트

현재 Controller 테스트 대부분은 Controller 객체를 직접 호출하므로 Spring MVC의 `@Valid`, JSON 역직렬화, Argument Resolver, 예외 변환을 실행하지 않는다.

추가 테스트:

- 빈 제목·본문 요청은 400
- `@Size` 초과 요청은 400
- 중첩 답안의 `questionId` 누락은 400
- Validation 오류가 `VALIDATION_FAILED` 형식으로 반환
- 인증 실패 401, 권한 실패 403, 검증 실패 400, 리소스 없음 404 구분

대상:

- `backend/src/test/java/com/uninote/backend/controller`
- `backend/src/test/java/com/uninote/backend/exception/GlobalExceptionHandlerTest.java`

근거:

- 현재 테스트는 Controller 메서드 위임은 검증하지만 실제 HTTP 계약은 충분히 검증하지 않는다.

### 2-3. API 문서 정합성 수정

대상:

- `docs/api.md`

현재 문서에는 업로드 API가 공개 경로로 설명되어 있으나 실제 구현은 다음과 다르다.

- 업로드 POST는 인증 필요
- 파일 조회·다운로드는 서명 URL 또는 레거시 화이트리스트 필요
- 신규 파일 URL에는 `owner`, `sig`가 포함됨

문서에 반영할 내용:

- 엔드포인트별 인증 요구사항
- 업로드·조회·다운로드 권한
- 서명 URL 형식과 접근 방식
- 레거시 파일 접근 조건
- Validation 오류 응답 형식

근거:

- `docs/api.md:3,68-70`
- `backend/src/main/java/com/uninote/backend/security/SecurityConfig.java`
- `backend/src/main/java/com/uninote/backend/controller/ImageUploadController.java:45-90,181-199`

## 3순위: 파일 보안 경계 강화

### 3-1. 업로드 실제 MIME·파일 시그니처 검증

대상:

- `backend/src/main/java/com/uninote/backend/controller/ImageUploadController.java`
- `backend/src/test/java/com/uninote/backend/controller/ImageUploadControllerTest.java`

현재 업로드 검사는 원본 파일명의 마지막 확장자 중심이다.

```java
String extension = extractExtension(originalFilename);
```

문제:

- 파일 내용이 이미지/PDF인지 확인하지 않는다.
- 클라이언트가 지정한 MIME은 신뢰할 수 없다.
- 확장자만 바꾼 파일이 허용될 수 있다.
- 서버가 파일을 브라우저에서 직접 표시하므로 콘텐츠 스니핑·XSS·표시 오류 위험이 있다.

작업:

- 이미지와 PDF의 실제 형식 검증
- 확장자와 파일 내용 불일치 차단
- 이미지·PDF별 용량 정책 확인
- 실패 시 생성 파일 정리
- 정상 이미지·PDF와 위장 파일 테스트 추가

근거:

- `ImageUploadController.java:201-226`
- `backend/src/main/resources/application.yaml:17-20`

### 3-2. 파일 서명 URL 만료 처리 검토

대상:

- `backend/src/main/java/com/uninote/backend/security/FileAccessSigner.java`
- `backend/src/main/java/com/uninote/backend/controller/ImageUploadController.java`

현재 서명 대상은 파일명과 사용자 ID이며 만료 시각이 없다.

문제:

- 서명 URL이 노출되면 계속 재사용할 수 있다.
- URL 자체가 인증 수단처럼 동작한다.

작업:

- 서명에 만료 시각을 포함할지 설계
- 서버에서 만료 검증
- 프론트 이미지·PDF 표시 흐름 유지
- 기존 레거시 파일 URL과의 호환 정책 결정
- 서명 만료·변조·다른 사용자 접근 테스트 추가

근거:

- `FileAccessSigner.java:20-43`
- `ImageUploadController.java:229-233`

## 4순위: 저장소 위생과 사용자 흐름 테스트

### 4-1. `.gitignore` 및 생성 파일 정리

대상:

- `.gitignore`
- `backend/uploads`
- `backend/.idea`
- 생성 로그·빌드 산출물

작업:

- `.idea/`, `backend/uploads/`, 로그, 빌드 산출물이 충분히 무시되는지 확인
- 이미 추적된 생성 파일을 Git index에서 정리
- `backend/backend-dev.log` 등 생성 파일 제거 여부 확인
- 현재 diff에서 API·인증·저장 계약의 비의도적 변경을 검토

근거:

- `.gitignore`는 새 파일만 무시하며 이미 추적된 파일은 자동으로 제거하지 않는다.
- IDE 파일·업로드 파일·로그는 소스가 아니며 저장소 변경 노이즈와 정보 노출 위험을 만든다.

### 4-2. 핵심 사용자 흐름 회귀 테스트 확장

현재 Frontend 테스트는 다음 세 영역에 집중되어 있다.

- `AuthContext.test.jsx`
- `SuggestionList.test.jsx`
- `useNoteAutosave.test.js`

추가 권장 테스트:

- 실제 Slash Command의 `/` 입력·필터·Enter·Escape
- Axios interceptor의 401/403 처리
- 업로드 후 이미지 표시
- PDF 새 탭 열기·다운로드 URL 구성
- 저장 실패 후 Retry
- 노트 전환 중 Autosave 취소
- 오늘의 복습 목록에서 CBTPlayer 진입
- 오답 풀이 결과의 통계 반영

근거:

- 현재 테스트 수는 통과했지만 주요 화면 연결과 사용자 흐름 커버리지는 제한적이다.

## 5순위: 조건부 간소화와 레거시 제거

### 5-1. Context 메모이제이션 재평가

대상:

- `frontend/src/context/AuthContext.jsx`
- `frontend/src/context/ThemeContext.jsx`
- `frontend/src/context/NoteTreeContext.jsx`
- `frontend/src/context/CourseContext.jsx`

`CourseContext`와 `NoteTreeContext`의 메모이제이션은 유지 우선이다. `ThemeContext`와 인증 함수의 `useCallback/useMemo`는 실제 렌더링 비용을 측정한 뒤 이득이 작을 때만 제거한다.

무조건 제거하면 Provider value 참조가 매 렌더마다 변경되어 하위 컴포넌트가 불필요하게 다시 렌더링될 수 있다.

### 5-2. QuizAttemptRequest의 클라이언트 점수 필드 제거 검토

대상:

- `backend/src/main/java/com/uninote/backend/dto/QuizAttemptRequest.java`
- `backend/src/main/java/com/uninote/backend/service/QuizService.java`
- `frontend/src/components/editor/components/CBTPlayer.jsx`

서버는 클라이언트의 `score`와 `isCorrect`를 신뢰하지 않고 직접 채점한다. 사용하지 않는 입력 필드는 API를 복잡하게 만든다.

단, 프론트 요청과 API 계약을 함께 변경할 수 있을 때만 제거한다. 기존 호환성이 필요한 동안에는 유지한다.

근거:

- `QuizAttemptRequest.java`
- `QuizService.java:175-200`
- `CBTPlayer.jsx:51-65`

### 5-3. 업로드 레거시 코드 제거

대상:

- `backend/src/main/java/com/uninote/backend/controller/ImageUploadController.java`

다음 코드는 기존 노트의 `/uploads/...` 참조를 보호하기 위해 유지한다.

- `legacyAllowedFilesRaw`
- `isLegacyAllowedFile()`
- `/uploads/{fileName}`
- `viewLegacyFile()`

제거 조건:

1. DB와 노트 콘텐츠에서 `/uploads/` 참조 검색
2. 신규 서명 URL로 마이그레이션
3. 레거시 참조가 없음을 확인
4. endpoint와 whitelist 제거
5. 기존 파일 표시·다운로드 테스트 통과

근거:

- `ImageUploadController.java:75-90,106-116`
- `backend/src/main/resources/application.yaml:file-access.legacy-allowed-files`

## 실행 순서

1. `AuthContext.login()` 토큰 검증과 테스트 추가
2. ProtectedRoute 라우팅 테스트 추가
3. Backend `@WebMvcTest`와 DTO Validation 보강
4. `docs/api.md`를 실제 구현 기준으로 갱신
5. `.gitignore`와 생성 파일·현재 diff 정리
6. 업로드 MIME·파일 시그니처 검증
7. 서명 URL 만료 정책 설계 및 적용 여부 결정
8. 핵심 사용자 흐름 회귀 테스트 확장
9. Context 메모이제이션 효과 측정
10. 필요할 때만 `QuizAttemptRequest` 필드와 레거시 업로드 코드 정리

## 검증 명령

- `backend\gradlew.bat test`
- `frontend\npm.cmd run test -- --run`
- `frontend\npm.cmd run lint`
- `frontend\npm.cmd run build`

## 완료 기준

- 인증 토큰과 보호 라우트 회귀 테스트가 존재한다.
- 실제 HTTP 요청의 Validation과 400/401/403/404 계약이 검증된다.
- API 문서가 실제 인증·업로드·응답 계약과 일치한다.
- 업로드 파일의 형식과 접근 경계가 검증된다.
- 저장소에 생성 파일·업로드 파일·IDE 개인 상태가 남지 않는다.
- 핵심 노트·퀴즈·오답노트·업로드 흐름에 회귀가 없다.
- API 계약 변경은 프론트·백엔드 동시 검증 후에만 적용한다.
- 레거시 업로드 코드는 데이터 마이그레이션 근거 없이 제거하지 않는다.

## 5. 오답노트 메뉴 분리 리팩터링 설계 (2026-09-22)

### 목표

현재 `QuizLibraryPage`의 세 번째 탭에 결합된 오답노트 기능을 생성 문제 모음과 동등한 별도 사이드바 메뉴로 분리한다. 오답노트 화면 내부는 다음 두 메뉴로 나눈다.

- **오답 통계**: 전체 정답률, 반복 오답, 오늘의 복습, 취약 강의·문제 유형 통계
- **오답노트 모음**: 사용자가 만든 오답노트 그룹 목록, 그룹별 재풀이, 그룹 삭제

기존 백엔드 API와 응답 형식은 변경하지 않고, 프론트엔드 라우팅·페이지·훅·표시 컴포넌트의 책임만 분리한다.

### 현재 구조와 분리 기준

현재 `QuizLibraryPage`와 `useQuizLibrary`가 생성 퀴즈 목록·풀이 기록과 함께 오답노트 그룹·통계·오늘의 복습·오답 재풀이 상태까지 모두 소유한다. 리팩터링 후에는 생성 문제 모음과 풀이 기록만 `QuizLibraryPage`/`useQuizLibrary`에 남긴다. 오답노트 그룹·통계·오늘의 복습 관련 상태와 조회 함수는 `IncorrectNotesPage`/`useIncorrectNotes`로 이동한다.

`CBTPlayer`를 여는 재풀이 상태는 두 페이지에서 공통으로 필요하므로 우선 각 페이지가 소유하되, 중복이 커질 경우에만 별도 세션 훅으로 추출한다. 불필요한 전역 Context는 추가하지 않는다.

### 라우팅 설계

```text
/quizzes                  생성 문제 모음 > 문제 모음 (기존 URL 유지)
/quizzes/history          생성 문제 모음 > 풀이 기록
/incorrect-notes          오답노트 > 오답 통계 (신규 기본 URL)
/incorrect-notes/groups   오답노트 > 오답노트 모음
```

- 기존 `/quizzes` 직접 접근과 인증 보호 동작은 유지한다.
- 기존 `/quizzes` 내부의 `오답노트` 탭은 제거한다.
- `/incorrect-notes`는 통계 화면을 기본으로 하여 별도 메뉴 클릭 시 요약 정보를 먼저 보여준다.
- 하위 메뉴를 URL로 표현해 새로고침·북마크·브라우저 뒤로 가기를 보존한다.
- 현재 코드에는 오답노트 탭을 외부에서 직접 접근하는 URL 계약이 없으므로 백엔드 API 변경이나 데이터 마이그레이션은 필요하지 않다.

### 파일별 변경 계획

#### 공통 라우팅·사이드바

- `frontend/src/App.jsx`
  - `IncorrectNotesPage` lazy import 추가
  - `/incorrect-notes`, `/incorrect-notes/groups` 보호 라우트 추가
  - `/quizzes/history`를 추가할 경우 기존 `/quizzes`와 같은 페이지에 history 모드 전달
- `frontend/src/components/layout/AppLayout.jsx`
  - 통계 또는 북마크 아이콘을 사용해 **오답노트** 최상위 메뉴 추가
  - `location.pathname.startsWith('/incorrect-notes')`로 하위 경로까지 활성 상태 처리
  - 기존 **생성 문제 모음** 메뉴는 `/quizzes` 계열만 활성화되도록 조건을 명확히 정리

#### 생성 문제 모음

- `frontend/src/pages/QuizLibraryPage.jsx`
  - `incorrect` 탭과 오답 관련 컴포넌트 import/render 제거
  - `문제 모음`, `풀이 기록`만 남김
  - 헤더 문구를 생성 퀴즈·풀이 기록 중심으로 조정
- `frontend/src/hooks/useQuizLibrary.js`
  - `incorrectGroups`, 통계 상태, 오늘의 복습 상태와 관련 fetch/action 제거
  - `activeTab`은 `quizzes | history`만 허용
  - 생성 퀴즈 도메인 액션만 반환
- `frontend/src/components/quiz/QuizListPanel.jsx`
  - 기존 동작 유지
- `frontend/src/components/quiz/QuizHistoryPanel.jsx`
  - 기존 동작 유지

#### 신규 오답노트 화면

- `frontend/src/pages/IncorrectNotesPage.jsx`
  - 현재 라우트 경로를 기준으로 `statistics | groups` 화면 선택
  - 공통 헤더와 하위 메뉴(오답 통계/오답노트 모음) 렌더링
  - `CBTPlayer`는 오답 그룹·오늘의 복습 재풀이에 계속 사용
- `frontend/src/hooks/useIncorrectNotes.js`
  - `/quiz/incorrect/groups`
  - `/quiz/incorrect/summary`
  - `/quiz/incorrect/statistics/courses`
  - `/quiz/incorrect/statistics/types`
  - `/quiz/incorrect/review-today`
  - 그룹 재풀이·그룹 삭제·오늘의 복습 개별 재풀이·원문 이동 액션 관리
  - `isGroupsLoading`과 `isStatisticsLoading`을 분리해 각 화면의 로딩 상태가 서로를 막지 않도록 설계
- `frontend/src/components/quiz/IncorrectStatisticsPanel.jsx` (신규, 권장)
  - `IncorrectSummaryCards`, `TodayReviewList`, `WeakAreaBreakdown`을 통계 화면의 섹션으로 조합
- `frontend/src/components/quiz/IncorrectGroupsPanel.jsx`
  - 오답노트 모음 화면에서 재사용
  - 표시와 액션 전달만 담당하도록 유지
- `frontend/src/components/quiz/IncorrectNotesTabs.jsx` (선택적 신규)
  - 두 하위 메뉴의 링크 스타일과 활성 상태를 공통 관리
  - JSX 중복이 적으면 `IncorrectNotesPage.jsx` 내부에 두고 별도 파일은 만들지 않는다

### 상태·데이터 로딩 설계

`useIncorrectNotes`는 최초 마운트 시 현재 경로에 필요한 데이터만 조회한다.

- `/incorrect-notes`: summary, course/type statistics, today review
- `/incorrect-notes/groups`: incorrect groups

통계 화면의 강의 필터 변경은 `review-today`만 재조회한다. 그룹 삭제 후에는 로컬 `setIncorrectGroups`로 목록을 즉시 갱신하고, 통계 화면 재진입 시 저장 오답 카드가 오래된 상태로 남지 않도록 통계 API를 다시 조회한다. 백엔드 응답 계약과 JWT/Axios 흐름은 그대로 유지한다.

### 호환성 및 UX 원칙

- `/quiz/incorrect/**` 백엔드 엔드포인트와 인증 흐름은 변경하지 않는다.
- 오답 그룹 재풀이, 오늘의 복습 개별 재풀이, 원문 블록 이동, 삭제 확인 동작은 기존과 동일하게 유지한다.
- 기존 다크 모드 클래스와 로딩·빈 상태 문구를 재사용한다.
- 생성 문제 모음에서 오답노트 기능을 제거하되, 사이드바에 새 최상위 메뉴를 같은 우선순위로 배치한다.
- `AppLayout`의 기존 `sidebarContent`(강의 상세 노트 트리)는 수정하지 않는다.

### 검증 계획

1. `frontend/src/App.test.jsx`에 인증 사용자의 `/incorrect-notes` 및 `/incorrect-notes/groups` 직접 접근 테스트를 추가한다.
2. 생성 문제 모음에 `문제 모음`, `풀이 기록`만 표시되는지 확인한다.
3. 오답 통계 화면에서 네 개 통계 API와 오늘의 복습 필터가 호출되는지 확인한다.
4. 오답노트 모음 화면에서 그룹 조회·재풀이·삭제가 동작하는지 확인한다.
5. `npm run lint`와 `npm run build`로 라우팅, lazy import, 미사용 import 제거를 검증한다.
6. 브라우저에서 사이드바 활성 상태, 두 신규 URL 직접 접근, 새로고침 후 하위 메뉴 유지, 다크 모드, 재풀이 모달, 원문 이동을 확인한다.

### 구현 순서

1. `IncorrectNotesPage`와 `useIncorrectNotes`를 추가하고 기존 오답 컴포넌트를 통합한다.
2. 라우팅과 사이드바에 신규 최상위 메뉴·하위 경로를 연결한다.
3. `QuizLibraryPage`와 `useQuizLibrary`에서 오답 상태·탭·렌더링을 제거한다.
4. 라우팅 테스트와 정적 검증을 추가한 뒤 프론트엔드 lint/build를 실행한다.
5. 기존 `/quizzes`와 신규 `/incorrect-notes*`의 기능 회귀를 브라우저에서 확인한다.
