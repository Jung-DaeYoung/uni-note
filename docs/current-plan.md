# 마이페이지 기능 구현 계획

## 문제와 목표

현재 UniNote에는 `/dashboard`가 수강 강의, 최근 노트, 최신 커뮤니티 게시글을 보여주지만, 사용자의 학습 활동을 종합적으로 확인하고 자신의 콘텐츠로 이동할 수 있는 별도 마이페이지는 없다.

별도 `/mypage` 화면을 추가하여 현재 학기의 학습 활동 히트맵을 중심으로 프로필 요약, 학습 통계, 강의별 현황, 최근 활동, 내 콘텐츠 관리 진입점을 제공한다. 기존 REST API와 인증 흐름을 유지하고, 이미 저장되는 노트·게시글/댓글·퀴즈·풀이·오답노트·공유 콘텐츠의 날짜와 소유자 정보를 재사용한다.

## 확정 범위

- 별도 보호 라우트: `/mypage`
- 현재 학기 기준 활동 히트맵
- 히트맵 활동 (원천 엔티티와 날짜 필드):
  - 노트 생성·수정: `Note.createdAt`, `Note.updatedAt` (집계 규칙은 아래 "고려사항" 참고)
  - 게시글 작성: `Post.createdAt`
  - 댓글 작성: `Comment`, `SharedNoteComment`, `SharedQuizComment`의 `createdAt`
  - AI 퀴즈 생성: `QuizSet.createdAt`
  - 퀴즈 풀이(복습 재풀이 포함): `QuizAttempt.startTime`
  - 오답노트 담기: `IncorrectNoteItem.addedAt`
  - 노트·퀴즈 공유: `SharedNotePost.createdAt`, `SharedQuiz.createdAt`
- 복습은 별도 활동으로 구분하지 않는다. 복습 재풀이도 `CBTPlayer`가 `POST /api/quiz/attempts`로 저장하므로 `QuizAttempt`로만 남는다. 간격 반복 일정은 `UserAnswer` 이력으로 계산하며, `UserAnswer`에는 날짜 필드가 없다.
- 프로필 요약: 로그인 사용자의 이름과 학번 기반 요약
- 학습 통계 카드: 노트, 퀴즈, 풀이, 오답노트 등 기존 데이터 기반 수치
- 강의별 학습 현황
- 최근 활동 타임라인
- 내 노트·내 퀴즈·내 공유 콘텐츠로 이동하거나 관리할 수 있는 목록/진입점
- 계정 비밀번호 변경 등 계정 설정은 이번 범위에서 제외

## 단계 분할

범위가 넓으므로 두 커밋으로 나눈다. 1차 커밋에서는 응답의 2차 필드를 비워 둔다.

- 1차: 프로필, 학기 정보, 통계 카드, 히트맵
- 2차: 강의별 현황, 최근 활동, 내 콘텐츠

## API 계약

`GET /api/mypage` (인증 필요, 본인 데이터만 조회)

```json
{
  "profile": { "name": "홍길동", "studentNum": "20231234" },
  "semester": { "label": "2026년 2학기", "startDate": "2026-09-01", "endDate": "2026-12-31" },
  "summary": {
    "noteCount": 0, "quizSetCount": 0, "attemptCount": 0,
    "incorrectNoteCount": 0, "postCount": 0, "commentCount": 0, "sharedCount": 0
  },
  "heatmap": [ { "date": "2026-09-03", "count": 4 } ],
  "courseProgress": [
    { "courseId": 1, "courseName": "운영체제", "noteCount": 0, "quizSetCount": 0, "attemptCount": 0, "lastActivityAt": "2026-10-13T21:00:00" }
  ],
  "recentActivities": [
    { "type": "NOTE_CREATED", "title": "...", "occurredAt": "2026-10-13T21:00:00", "courseId": 1, "targetId": 10 }
  ],
  "myContents": {
    "recentNotes": [ { "noteId": 10, "courseId": 1, "title": "...", "updatedAt": "..." } ],
    "sharedNotes": [ { "postId": 3, "title": "...", "createdAt": "..." } ],
    "sharedQuizzes": [ { "sharedQuizId": 5, "title": "...", "createdAt": "..." } ]
  }
}
```

- `heatmap`에는 활동이 있는 날만 담는다. 학기 범위의 빈 날짜는 프론트가 `semester.startDate`~`endDate`로 채운다.
- `summary`는 전체 누적 수치이고, `heatmap`만 학기 범위로 집계한다.
- `recentActivities`는 학기와 관계없이 최신순 20건이다. `type` 값: `NOTE_CREATED`, `NOTE_UPDATED`, `POST_CREATED`, `COMMENT_CREATED`, `QUIZ_GENERATED`, `QUIZ_ATTEMPTED`, `INCORRECT_NOTE_ADDED`, `NOTE_SHARED`, `QUIZ_SHARED`
- 필드명은 구현 시 기존 DTO 명명(`DashboardResponse` 등)에 맞춰 조정할 수 있다. 확정된 내용은 `docs/api.md`에 반영한다.

## 구현 단계

### 1. 기존 데이터와 학기 기준 정리

- 노트·게시글·댓글·퀴즈 생성·퀴즈 풀이·오답노트·공유 노트/퀴즈의 사용자 및 날짜 필드를 활동 원천으로 매핑한다.
- 현재 코드에 학기 엔티티/필드가 없으므로 달력 규칙으로 계산한다.
  - 1학기: 3/1 ~ 6/30, 2학기: 9/1 ~ 12/31
  - 7~8월에는 그해 1학기를, 1~2월에는 전년도 2학기를 보여준다.
- "오늘"은 `Asia/Seoul` 기준이다. DB 연결은 `serverTimezone=Asia/Seoul`이지만 운영 JVM의 기본 시간대는 UTC일 수 있다. `LocalDate.now()`를 직접 쓰지 않고, 주입한 `Clock`(zone `Asia/Seoul`)을 사용해 테스트에서 날짜를 고정한다.
- 기존 삭제·공유 철회 동작이 마이페이지 통계에 미치는 영향을 정의한다. 원칙적으로 현재 조회 가능한 데이터만 집계하고, 삭제된 활동을 별도 감사 로그로 복원하지 않는다.

### 2. 백엔드 마이페이지 조회 API 추가

- `MyPageController`, `MyPageService`, 응답 DTO, 필요한 Repository 조회를 추가한다.
- 인증된 `Authentication.getName()`의 학번만 사용하여 자기 데이터만 조회한다.
- 단일 초기 조회 API를 우선 설계한다. 응답에는 `profile`, `summary`, `heatmap`, `courseProgress`, `recentActivities`, `myContents`를 포함한다.
- 히트맵은 날짜별 활동 수를 반환하며, 서버에서 현재 학기 시작일·종료일 범위를 적용한다.
- 응답 형태는 위 "API 계약"을 따른다. 프로필은 `StudentRepository.getByStudentNum`으로 조회한다(`AuthContext`에는 이름이 없다).
- 히트맵은 원천별로 `학생 + 기간` 조건의 날짜별 `GROUP BY` 집계 쿼리를 쓰고, 서비스에서 날짜별로 합친다. 엔티티 전체를 불러와 메모리에서 세지 않는다.
- 강의별 현황의 강의 목록은 `DashboardService`와 같은 원천을 쓴다. 수강 강의(`EnrollmentRepository.findByStudent`)에 직접 만든 강의(`CourseRepository.findByOwner_StudIdAndUserCreatedTrueOrderByCourseIdAsc`)를 더한다. 직접 만든 강의에는 Enrollment가 없다.
- 익명 게시판의 게시글·댓글은 본인 응답에만 담는다. 다른 사용자에게 작성자가 드러나지 않는 기존 동작을 유지한다.
- 기존 API 응답 필드와 접근 권한 동작은 변경하지 않는다.

### 3. 프론트엔드 마이페이지 화면과 API 연결

- `MyPage` 전용 API 호출 훅/상태를 추가하고 로딩·오류·빈 상태를 기존 UI 패턴에 맞춰 처리한다.
- `App.jsx`에 보호 라우트 `/mypage`를 추가한다.
- `AppLayout` 사이드바에 마이페이지 메뉴와 현재 경로 활성 상태를 추가한다.
- 카드, 히트맵, 강의별 현황, 최근 활동, 내 콘텐츠 영역을 반응형으로 구성하고 라이트/다크 테마를 지원한다.
- 활동 셀 hover/focus 시 날짜와 활동 수를 표시하고, 활동이 없는 기간과 데이터가 적은 사용자도 자연스럽게 보이도록 한다.
- 히트맵 색 단계는 고정 구간을 쓴다: 0 / 1–2 / 3–5 / 6–9 / 10 이상.
- 각 항목은 기존 라우트로 연결한다.
  - 노트: `/course/:courseId/note/:noteId` (courseId가 필요하다)
  - 강의: `/course/:courseId`
  - 내 퀴즈·풀이 기록: `/quizzes`
  - 오답노트: `/incorrect-notes`
  - 공유 노트: `/shared-notes/:postId`
  - 공유 시험: 상세 라우트가 없으므로 `/shared-quizzes` 목록으로 이동한다.

### 4. 검증과 회귀 확인

- 백엔드 단위 테스트(Mockito)로 다음을 검증한다.
  - 학기 경계: 2/28, 3/1, 6/30, 7/1, 8/31, 9/1, 12/31, 1/1
  - 본인 데이터 필터, 원천별 날짜 합산, 노트 중복 집계 규칙, 빈 데이터 응답
- 백엔드 테스트는 Mock 기반이고 H2/`@DataJpaTest`가 없다. 따라서 `@Query` JPQL 오류는 서버 기동 시점에만 드러난다. `gradlew.bat bootRun`으로 기동을 확인하고, 실제 계정으로 `GET /api/mypage`를 호출해 응답을 확인한다.
- 프론트엔드 테스트(vitest)로 라우팅, 로딩/오류/빈 상태, 히트맵 렌더링과 주요 링크를 검증한다.
- `backend\gradlew.bat test`, `frontend`의 `npm run lint`, `npm run build`, `npm run test`를 실행한다.
- 브라우저에서 `/mypage`의 라이트·다크 모드와 각 링크 이동을 확인한다.
- 기존 대시보드, 인증, 노트·퀴즈·공유 기능의 API 계약과 화면 이동이 변하지 않았는지 확인한다.

## 주요 변경 예상 파일

- Backend: `controller/MyPageController.java`, `service/MyPageService.java`, `dto/MyPageResponse.java` 및 세부 DTO, 활동 집계가 필요한 `repository` 파일
- Frontend: `src/pages/MyPage.jsx`, 마이페이지 API 훅 또는 클라이언트 모듈, `src/App.jsx`, `src/components/layout/AppLayout.jsx`
- Tests: 관련 백엔드 테스트와 `frontend/src`의 페이지/API 테스트
- Documentation: 실제 엔드포인트와 응답 계약을 확정한 뒤 `docs/api.md`에 반영한다. 엔티티 변경이 없으므로 `docs/database.md`는 갱신하지 않는다.

## 작업 분담

- 이 계획 단계에서는 코드 구현을 진행하지 않는다.
- 구현은 Claude Code가 담당한다.
- Claude Code는 이 계획을 기준으로 구현·테스트를 수행한다.

## 고려사항과 확정 정책

- 현재 데이터 모델에는 학기/수강 학기 필드가 없으므로 달력 규칙으로 현재 학기를 계산한다(구현 단계 1 참고). 경계는 백엔드 테스트로 고정한다.
- 노트 집계 규칙: 노트 1개는 생성일에 1회로 센다. 마지막 `updatedAt`의 날짜가 생성일과 다르면 그날에 1회를 더 센다.
  - `Note.updatedAt`은 `@UpdateTimestamp`다. 자동 저장뿐 아니라 제목 변경·트리 이동 같은 엔티티 갱신에서도 바뀌고, 생성 직후에는 `createdAt`과 같은 날이다.
  - 수정 이력은 누적되지 않으므로 마지막 수정일만 남는다. 정확한 수정 이력이 필요해지면 별도 활동 로그를 후속 도입한다.
- 댓글 활동은 일반 강의 게시판 댓글, 공유 노트 댓글, 공유 퀴즈 댓글을 모두 포함한다.
- 강의별 현황은 노트 수, 퀴즈 생성 수, 풀이 수, 최근 활동일을 보여주는 활동 요약으로 시작한다. 평가 기준이 없는 강의 전체 진도율은 임의로 산정하지 않는다.
- “내 콘텐츠 관리”는 기존 목록·삭제 화면으로의 진입점부터 제공하고, 별도 일괄 관리·편집 기능은 추가 요구가 있을 때 확장한다.
