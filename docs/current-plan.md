# 코드 간소화 계획

## 목표

기존 기능과 API 계약을 유지하면서 사용되지 않는 코드, 중복 상태, 효과가 불확실한 최적화, 과도한 주석을 정리한다. 보안·권한·노트 저장·업로드·퀴즈 풀이 회귀를 우선적으로 방지한다.

## 1. 즉시 정리 가능

### 1-1. 사용되지 않는 NoteRepository 메서드 제거

대상:

- `backend/src/main/java/com/uninote/backend/repository/NoteRepository.java`

검토 결과 다음 메서드는 선언부 외 실제 운영 코드 호출이 확인되지 않았다.

```java
findByCourseAndParentNoteIsNullOrderByCreatedAtAsc(Course course)
findByCourseAndStudentAndParentNoteIsNullOrderByCreatedAtAsc(Course course, Student student)
```

현재 노트 트리는 다음 메서드 하나로 조회한다.

```java
findByCourseAndStudentOrderByCreatedAtAsc(Course course, Student student)
```

관련 테스트와 참조를 다시 확인한 후 미사용 메서드 2개를 제거한다.

### 1-2. AuthContext 인증 상태 중복 정리 검토

대상:

- `frontend/src/context/AuthContext.jsx`

현재 `token`과 `isAuthenticated`를 별도 상태로 보관하지만 항상 함께 변경된다. 운영 코드에서 Axios interceptor는 `localStorage`를 직접 읽고, Context의 `token` 사용은 테스트와 로그인 응답 처리에 한정되어 있다.

검토 방향:

- `token`만 상태로 유지한다.
- `isAuthenticated`는 `token !== null`로 계산한다.
- `setIsAuthenticated`를 제거한다.
- Context value에서 외부 사용이 없는 `token`을 제거할지 함께 확인한다.

로그인·로그아웃·만료 토큰·다중 탭 동기화 테스트를 통과한 경우에만 적용한다.

## 2. 중간 우선순위 정리

### 2-1. CourseDetailPage의 과도한 useMemo 정리

대상:

- `frontend/src/pages/CourseDetailPage.jsx`

`sidebarContent`와 `headerContent` 전체 JSX를 `useMemo`로 감싸고 있지만, 이를 전달받는 `AppLayout`이 메모이제이션된 컴포넌트가 아니므로 효과가 제한적이다. 의존성을 누락하기 위한 `eslint-disable`도 유지보수 위험을 높인다.

검토 방향:

- 실제 병목이 측정되지 않았다면 JSX `useMemo`를 제거한다.
- 유지할 경우 모든 의존성을 정확히 포함한다.
- 노트 전환, 저장 상태 표시, 게시판 토글, 노트 생성·삭제 회귀를 확인한다.

### 2-2. StudentRepository helper 책임 재검토

대상:

- `backend/src/main/java/com/uninote/backend/repository/StudentRepository.java`

`getByStudentNum()`은 인증된 사용자 조회 중복을 줄였지만 Repository 계층에서 `ResourceNotFoundException`을 결정한다. 현재 동작은 명확하므로 즉시 제거하지 않는다.

후속 선택지:

- 현재 helper 유지
- 인증 사용자 조회를 별도 서비스로 이동
- 공통 argument resolver 도입

새 추상화는 반복이 실제로 줄어드는 경우에만 적용한다.

### 2-3. React Context 메모이제이션 재검토

대상:

- `frontend/src/context/AuthContext.jsx`
- `frontend/src/context/ThemeContext.jsx`
- `frontend/src/context/NoteTreeContext.jsx`
- `frontend/src/context/CourseContext.jsx`

Context value 메모이제이션은 일부 유효하지만 모든 `useMemo/useCallback`이 동일한 가치가 있는 것은 아니다. `CourseContext`와 `NoteTreeContext`는 유지 우선이며, `ThemeContext`와 인증 함수의 최적화는 측정 결과에 따라 단순화한다.

## 3. API 계약 변경 시 정리 후보

### 3-1. QuizAttemptRequest의 클라이언트 점수 필드 검토

대상:

- `backend/src/main/java/com/uninote/backend/dto/QuizAttemptRequest.java`
- `backend/src/main/java/com/uninote/backend/service/QuizService.java`
- `frontend/src/components/editor/components/CBTPlayer.jsx`

서버는 `score`와 `isCorrect`를 신뢰하지 않고 직접 채점한다. 보안상 현재 동작은 유지해야 한다.

프론트 요청과 API 계약을 함께 변경할 수 있을 때 다음 필드 제거를 검토한다.

```java
private Integer score;
private Boolean isCorrect;
```

계약 변경 전에는 기존 프론트 요청 호환을 위해 유지한다.

### 3-2. ProtectedRoute 반복 정리

대상:

- `frontend/src/App.jsx`

여러 Route에서 동일한 `ProtectedRoute` 래퍼가 반복된다. React Router 중첩 라우트로 보호 레이아웃을 한 번 선언하는 방식을 검토한다.

라우팅 구조 변경은 낮은 우선순위로 두고, 적용 시 직접 URL 접근·로그인 리다이렉트·새로고침·잘못된 경로 회귀를 검증한다.

## 4. 제거하면 안 되는 코드

다음은 현재 실제로 사용 중이므로 단순 참조 수만 보고 삭제하지 않는다.

- `QuestionAnswerStat`
- `QuizSetQuestionCount`
- `CourseResponse`
- `NoteSummaryResponse`
- `FileAccessSigner`
- `InvalidRequestException`
- `CourseAccessException`
- `ExternalServiceException`
- `useSourceBlockScroll`
- `useNoteUploads`
- `NoteTreeContext`
- `useQuizLibrary`

## 5. 레거시 호환 코드

대상:

- `backend/src/main/java/com/uninote/backend/controller/ImageUploadController.java`

다음 코드는 기존 노트가 `/uploads/{fileName}` URL을 참조할 가능성 때문에 즉시 제거하지 않는다.

- `legacyAllowedFilesRaw`
- `isLegacyAllowedFile()`
- `/uploads/{fileName}` endpoint
- `viewLegacyFile()`

기존 DB 노트 콘텐츠의 파일 URL을 새 서명 URL로 전부 마이그레이션하고 실제 참조가 없음을 확인한 뒤 제거한다.

## 6. 주석 정리

대상:

- `frontend/src/components/editor/hooks/useNoteAutosave.js`
- `frontend/src/context/CourseContext.jsx`
- `frontend/src/context/NoteTreeContext.jsx`
- `frontend/src/components/editor/extensions/PdfBlock.jsx`
- `backend/src/main/java/com/uninote/backend/controller/ImageUploadController.java`
- `backend/src/main/java/com/uninote/backend/repository/QuizAttemptRepository.java`

코드 자체로 의도가 명확한 주석은 제거하고 다음 내용만 남긴다.

- 레거시 파일 호환 이유
- StrictMode와 AbortController의 비직관적 동작
- Tiptap schema와 Enter 처리의 특수성
- 서명 URL의 보안 경계

## 7. 실행 순서

1. `NoteRepository` 미사용 메서드 참조와 테스트를 재확인한다.
2. 미사용 메서드 2개를 제거한다.
3. Backend 테스트를 실행한다.
4. `AuthContext` 중복 상태 제거 가능성을 검토하고 인증 회귀 테스트를 보강한다.
5. `CourseDetailPage` JSX `useMemo`와 eslint 예외를 정리한다.
6. Frontend 테스트·lint·build를 실행한다.
7. API 계약 변경이 필요한 경우에만 `QuizAttemptRequest` 필드 제거를 별도 작업으로 진행한다.
8. 레거시 파일 URL 마이그레이션이 완료된 후 업로드 호환 코드를 제거한다.
9. 마지막으로 과도한 주석과 반복 ProtectedRoute를 별도 정리한다.

## 완료 기준

- 실제 사용 중인 기능·API·저장 형식이 변경되지 않는다.
- 미사용 Repository 메서드와 중복 상태가 제거된다.
- 인증·노트 저장·업로드·퀴즈 풀이 회귀가 없다.
- Backend 테스트가 통과한다.
- Frontend 테스트, lint, build가 통과한다.
- 레거시 파일 호환 코드는 데이터 마이그레이션 근거 없이 제거하지 않는다.
