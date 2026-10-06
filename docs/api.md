# UniNote API

모든 경로는 `/api` 기준이다. `/auth/**`, `/upload/**`는 공개 경로이고, 그 외 API는 인증이 필요하다. 인증 요청은 `Authorization: Bearer <JWT>` 헤더를 사용한다.

## 인증·대시보드

| Method | Endpoint | 인증 | 요청 | 응답 |
|---|---|---:|---|---|
| POST | `/auth/login` | 아니오 | `{ studentNum, password }` | `{ token, studentNum }` |
| GET | `/dashboard/courses` | 예 | 없음 | `DashboardResponse` |

## 노트

| Method | Endpoint | 인증 | 요청 | 응답 |
|---|---|---:|---|---|
| GET | `/notes/{noteId}` | 예 | 없음 | `NoteResponse` |
| GET | `/courses/{courseId}/notes/tree` | 예 | 없음 | `NoteTreeResponse[]` |
| POST | `/courses/{courseId}/notes` | 예 | 선택 query `parentNoteId` | `NoteResponse` |
| PUT | `/notes/{noteId}` | 예 | `{ title, content, previewText, searchContent }` | `NoteResponse` |
| DELETE | `/notes/{noteId}` | 예 | 없음 | 빈 응답 |

## 게시판·댓글

| Method | Endpoint | 인증 | 요청 | 응답 |
|---|---|---:|---|---|
| GET | `/posts/{courseId}` | 예 | 없음 | `PostResponse[]` |
| POST | `/posts/{courseId}` | 예 | `{ title, content }` | `PostResponse` |
| PUT | `/posts/{postId}` | 예 | `{ title, content }` | `PostResponse` |
| DELETE | `/posts/{postId}` | 예 | 없음 | 빈 응답 |
| POST | `/posts/{postId}/comments` | 예 | `{ content }` | 빈 응답 |
| PUT | `/posts/comments/{commentId}` | 예 | `{ content }` | 빈 응답 |
| DELETE | `/posts/comments/{commentId}` | 예 | 없음 | 빈 응답 |

## 퀴즈·풀이

| Method | Endpoint | 인증 | 요청 | 응답 |
|---|---|---:|---|---|
| POST | `/quiz/generate` | 예 | `{ noteIds, typeCounts, difficulty, blockSelections? }` — `blockSelections: [{ noteId, blockIds }]`(선택)에 있는 노트는 해당 블록과 하위 블록만, 나머지 `noteIds` 노트는 전체로 생성. `noteId`는 `noteIds`에 포함되어야 하며 전체 블록은 최대 500개 | `QuizResponse` |
| GET | `/quiz/my` | 예 | 없음 | `QuizSetResponse[]` |
| GET | `/quiz/{quizSetId}` | 예 | 없음 | `QuizSetDetailResponse` |
| DELETE | `/quiz/{quizSetId}` | 예 | 없음 | 빈 응답 |
| POST | `/quiz/attempts` | 예 | `{ quizSetId, userAnswers[] }` | 빈 응답 |
| GET | `/quiz/attempts/my` | 예 | 없음 | `QuizAttemptResponse[]` |
| GET | `/quiz/attempts/{attemptId}` | 예 | 없음 | `QuizAttemptDetailResponse` |
| DELETE | `/quiz/attempts/{attemptId}` | 예 | 없음 | 빈 응답(204). 답안도 함께 삭제되어 오답 통계에서 빠진다 |
| GET | `/quiz/{quizSetId}/attempts` | 예 | 없음 | `QuizAttemptResponse[]` |

`userAnswers[]`의 항목은 `questionId`, `submittedAnswer`, `isCorrect`를 가진다.

`QuizSetResponse.shared`는 원본 퀴즈를 CBT 시험 공유게시판에 올렸는지 나타낸다. `POST /quiz/attempts`는 본인 퀴즈 외에 게시 중인 공유 스냅샷(수강 중인 강의)도 받는다. 가상 세션(`quizSetId` 음수/없음)의 문제는 본인 문제, 게시 중인 공유 문제, 이미 풀었거나 오답노트에 담은 문제를 허용한다.

## CBT 시험 공유게시판

| Method | Endpoint | 인증 | 요청 | 응답 |
|---|---|---:|---|---|
| GET | `/shared-quizzes` | 예 | query `sort`(`latest`·`likes`·`views`, 기본 `latest`), `courseId`(선택) | `SharedQuizResponse[]` (수강 중인 강의의 글) |
| POST | `/shared-quizzes` | 예 | `{ quizSetId }` (본인 원본 퀴즈) | 빈 응답. 이미 공유한 원본이면 400 |
| GET | `/shared-quizzes/{sharedQuizId}` | 예 | 없음 | `QuizSetDetailResponse` (공유 스냅샷, 조회수 +1) |
| DELETE | `/shared-quizzes/{sharedQuizId}` | 예 | 없음 | 빈 응답(204). 작성자만 가능 |
| POST | `/shared-quizzes/{sharedQuizId}/like` | 예 | 없음 | `{ liked, likeCount }` (추천 토글) |

`SharedQuizResponse`는 `sharedQuizId`, `quizSetId`(스냅샷), `courseId`, `courseName`, `title`, `difficulty`, `questionCount`, `authorName`(익명), `isAuthor`, `likeCount`, `viewCount`, `liked`, `createdAt`을 가진다. 공유 시 원본은 출처(`sourceNoteId`/`sourceBlockId`) 없이 소유자 없는 스냅샷으로 복사되므로 원문 보기가 제공되지 않고, 원본 삭제나 글 삭제가 다른 학생의 풀이 기록·오답노트에 영향을 주지 않는다.

## 오답노트

| Method | Endpoint | 인증 | 요청 | 응답 |
|---|---|---:|---|---|
| GET | `/quiz/incorrect/groups` | 예 | 없음 | `IncorrectNoteGroupResponse[]` |
| POST | `/quiz/incorrect/add-to-group` | 예 | `{ groupId, newGroupTitle, questionId }` | 빈 응답 |
| DELETE | `/quiz/incorrect/groups/{groupId}` | 예 | 없음 | 빈 응답 |
| GET | `/quiz/incorrect/groups/{groupId}/practice` | 예 | 없음 | `QuizSetDetailResponse` |
| GET | `/quiz/incorrect/summary` | 예 | 없음 | `IncorrectSummaryResponse` |
| GET | `/quiz/incorrect/statistics/courses` | 예 | 없음 | `CourseIncorrectStatResponse[]` |
| GET | `/quiz/incorrect/statistics/types` | 예 | 없음 | `QuestionTypeIncorrectStatResponse[]` |
| GET | `/quiz/incorrect/statistics/blocks` | 예 | 없음 | `SourceBlockStatResponse[]` (출처 블록별 풀이 통계, 취약 블록 먼저) |
| GET | `/quiz/incorrect/review-today` | 예 | query `limit`(기본 10), `courseId`(선택) | `TodayReviewQuestionResponse[]` |

## 파일

| Method | Endpoint | 인증 | 요청 | 응답 |
|---|---|---:|---|---|
| POST | `/upload/image` | 아니오 | multipart `file` | `{ url }` |
| POST | `/upload/file` | 아니오 | multipart `file` | `{ url, title }` |
| GET | `/upload/download/{fileName}` | 아니오 | query `originalName` | 파일 응답 |
