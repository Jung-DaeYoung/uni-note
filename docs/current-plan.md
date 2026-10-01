# 과잉 구현 정리 2차 계획 (2026-10-01)

1차 정리(`dbde944`) 이후 `ponytail-audit`을 다시 돌려 찾은 15건을 정리한다. 남은 것은 대부분 자잘한 중복과 쓰이지 않는 코드다. 동작·API 응답·DB 저장 형식은 바꾸지 않는다(예외는 3단계 한 건).

## 범위와 원칙

- 대상은 중복 코드, 쓰이지 않는 코드, 필요 없는 설정이다. 버그·보안·성능은 범위 밖이다.
- REST 경로, 응답 필드명, 상태 코드, 오류 메시지 문구는 그대로 유지한다.
- 화면이 달라지는 항목은 3단계의 블록 메뉴 "AI 요약/질문" 버튼 삭제 하나뿐이다. 사용자 확인을 받아 진행했다.
- 테스트 코드는 감사 대상이 아니었다. 정리한 코드를 검증하던 테스트만 함께 고친다.
- 줄 수는 추정치다. 전체 약 -105줄, 의존성 -1개(선택).
- 단계마다 따로 커밋할 수 있게 서로 독립적으로 나눴다.

## 구현 단계

### 1. backend: 컨트롤러·서비스 중복 제거 (약 -36줄)

- `QuizController`(8곳)와 `IncorrectNoteController`(10곳)의 `Student student = …;` 지역 변수를 서비스 호출 인자로 인라인한다. `QuizController`에도 `IncorrectNoteController`와 같은 `getStudent(principal)` 헬퍼를 둔다.
- `DashboardService`의 게시글 → `PostResponse` 변환이 `PostService.convertToResponse`의 "익명 N" 작성자 로직과 빌더를 복제한다. 댓글을 뺀 공통 변환을 한 곳에 두고 양쪽에서 호출한다.
  - 대시보드 응답(`recentPosts`)에 댓글이 들어가지 않는 현재 형식을 유지한다. 댓글을 넣으면 응답이 바뀌고 lazy loading 쿼리도 늘어난다.
  - `PostService`는 작성자 비교에 `trim()`을 쓰고 `DashboardService`는 쓰지 않는다. 공통화할 때 `trim()`을 쓰는 쪽으로 맞춘다.
- `PostService`의 작성자 본인 확인 4곳을 `requireAuthor(owner, studentNum, message)`로 뽑는다. 오류 메시지 문구는 그대로 둔다.
- (보류) `validateEnrollment`가 `NoteService`와 `PostService`에 똑같이 있다. `EnrollmentRepository`의 `default` 메서드로 옮기면 리포지토리를 mock으로 쓰는 서비스 테스트에서 검증이 실행되지 않아 테스트를 여러 개 고쳐야 한다. 4줄 중복이라 그대로 둔다.

### 2. backend: 쓰이지 않는 코드·설정 삭제 (약 -5줄)

- `UserAnswerRepository.findByQuizAttempt_AttemptId` 삭제. 호출부가 없다.
- `QuestionAnswerStat.getType()`과 집계 쿼리의 `q.type AS type`, `GROUP BY`의 `q.type` 삭제. 서비스는 `Question.getType()`을 읽는다.
- `application.yaml`의 `hibernate.dialect`(기동 시 Hibernate가 불필요하다고 경고, HHH90000025)와 `driver-class-name`(JDBC URL에서 자동 판별) 삭제.
  - `application-prod.yaml`과 `application-local.yaml.example`에 같은 설정이 있으면 함께 지운다.

### 3. frontend: 블록 핸들 정리 (약 -21줄)

- (확인 완료) 블록 메뉴의 "AI 요약/질문" 버튼 삭제. `alert`만 띄우는 스텁이다. `handleAiAction`, 버튼, 구분선, `Sparkles` import를 함께 지운다. 메뉴에서 항목이 사라지므로 화면이 바뀐다.
- `pos` 상태에서 항상 0인 `left`를 빼고 `top`만 보관한다.
- 메뉴 바깥 클릭 effect를 `if (!isMenuOpen) return;` 후 리스너 등록·해제로 줄인다.

### 4. frontend: 퀴즈 화면 정리 (약 -16줄)

- `CBTPlayer.jsx`: `calculateScore`의 루프와 결과 화면의 정답 판정이 같은 비교를 중복한다. `isCorrectAt(q, idx)` 하나와 `questions.filter(isCorrectAt).length`로 합친다.
  - 비교 규칙(trim + 소문자)은 서버 채점(`QuizService.isAnswerCorrect`)과 같게 유지한다.
  - report 모드는 지금처럼 서버가 준 `isCorrect`와 `score`를 쓴다.
- `IncorrectNoteModal.jsx`: `finally`의 `setIsLoading(true); // 실제로는 false여야 함` 죽은 줄 삭제.
- `IncorrectNoteModal.jsx`의 `fetchGroups`, `QuizAttemptsModal.jsx`의 `fetchAttempts`는 호출부가 effect 하나뿐이다. `useCallback`을 걷어내고 effect 안으로 옮긴다.
- `CBTPlayer.jsx`, `useIncorrectNotes.js`: 이동 state의 `sourceNavigationId` 삭제. 읽는 곳이 없다.
- `CourseDetailPage.jsx`: `QuizConfigModal`이 받지 않는 `courseId` prop 삭제, `handleSaveStateChange` `useCallback` 대신 `setSaveState`를 직접 전달.

### 5. frontend: 쓰이지 않는 설정·파일 삭제 (약 -27줄)

- `vite.config.js`: 쓰이지 않는 `@` 경로 별칭과 이를 위한 `path`/`url` import, `__dirname` 삭제.
- `index.css`: 참조가 없는 CSS 변수 5개 삭제(`--primary-color`, `--secondary-color`, `--card-bg`, `--text-muted`, `--border-color`). `--bg-color`와 `--text-main`은 쓰이므로 남긴다.
- `frontend/README.md`: Vite 템플릿 기본 문서다. 삭제하거나 실행 방법(`npm install`, `npm run dev`, `.env.example` 안내) 몇 줄로 교체한다.

### 6. (선택) lodash.debounce 제거

- `useNoteAutosave.js`의 debounce 두 개를 `setTimeout`/`clearTimeout`으로 바꾸면 의존성이 하나 준다.
- 줄 수는 줄지 않고 자동 저장 debounce 계약(서버 2000ms, localStorage 300ms, `cancel`)을 건드린다. 1차 계획에서도 보류한 항목이며, 1~5단계와 따로 판단한다.

## 수정 대상 파일

backend (`backend/src/main/`)

- `java/com/uninote/backend/controller/QuizController.java`, `IncorrectNoteController.java`
- `java/com/uninote/backend/service/DashboardService.java`, `PostService.java`
- `java/com/uninote/backend/repository/UserAnswerRepository.java`, `QuestionAnswerStat.java`
- `resources/application.yaml` (같은 설정이 있으면 `application-prod.yaml`, `application-local.yaml.example`)

frontend (`frontend/`)

- `src/components/editor/components/BlockHandle.jsx`, `CBTPlayer.jsx`, `IncorrectNoteModal.jsx`, `QuizAttemptsModal.jsx`
- `src/hooks/useIncorrectNotes.js`
- `src/pages/CourseDetailPage.jsx`
- `src/index.css`, `vite.config.js`, `README.md`
- `src/components/editor/hooks/useNoteAutosave.js`, `package.json`, `package-lock.json` (6단계만)

## 테스트

- 기존 테스트는 수정 없이 통과해야 한다. 특히 다음이 응답 형식과 동작이 그대로임을 확인해 준다.
  - backend: `DashboardServiceTest`, `PostServiceTest`, `NoteServiceTest`, `IncorrectNoteServiceTest`, `QuizControllerTest`, `IncorrectNoteControllerTest`
  - frontend: `CBTPlayer.test.jsx`
- `IncorrectNoteServiceTest`가 `QuestionAnswerStat.getType()`을 스텁하고 있으면 그 줄만 지운다.
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

실서버 확인 (local 프로파일, `docs/0928.md`의 테스트 계정)

- 백엔드가 dialect 경고 없이 기동하고 MySQL에 정상 연결되는지.
- 대시보드 응답의 `recentPosts`에 `comments`가 추가되지 않았는지, `authorName`·`isAuthor`가 그대로인지.
- 게시글·댓글 수정·삭제에서 본인이 아닐 때 403과 기존 메시지가 나오는지.
- 풀이 제출 후 오답 통계(요약·강의별·유형별·문제별·오늘의 복습) 수치가 정리 전과 같은지.

수동 확인

- 블록 핸들이 마우스를 따라 움직이고, 메뉴가 바깥 클릭으로 닫히며, 복제·삭제·드래그 이동이 되는지.
- 퀴즈 풀이 후 결과 화면의 점수와 문항별 정오 표시가 맞는지, 풀이 이력의 과거 결과(report 모드)가 그대로 보이는지.
- 오답노트 담기 모달과 풀이 기록 모달이 열릴 때 목록을 불러오는지.
- 결과 화면과 오늘의 복습에서 "원문 보기"가 해당 블록으로 이동·하이라이트하는지.

## 완료 기준

- 1~5단계가 반영되고 backend 테스트, frontend lint·build·test가 모두 통과한다.
- REST 경로, 응답 필드, 상태 코드, 오류 메시지가 정리 전과 같다.
- 화면 변화는 블록 메뉴의 "AI 요약/질문" 항목이 사라지는 것 하나뿐이다(확인을 받은 경우).
