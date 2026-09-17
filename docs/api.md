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
| POST | `/quiz/generate` | 예 | `{ noteIds, typeCounts, difficulty }` | `QuizResponse` |
| GET | `/quiz/my` | 예 | 없음 | `QuizSetResponse[]` |
| GET | `/quiz/{quizSetId}` | 예 | 없음 | `QuizSetDetailResponse` |
| DELETE | `/quiz/{quizSetId}` | 예 | 없음 | 빈 응답 |
| POST | `/quiz/attempts` | 예 | `{ quizSetId, score, userAnswers[] }` | 빈 응답 |
| GET | `/quiz/attempts/my` | 예 | 없음 | `QuizAttemptResponse[]` |
| GET | `/quiz/attempts/{attemptId}` | 예 | 없음 | `QuizAttemptDetailResponse` |
| GET | `/quiz/{quizSetId}/attempts` | 예 | 없음 | `QuizAttemptResponse[]` |

`userAnswers[]`의 항목은 `questionId`, `submittedAnswer`, `isCorrect`를 가진다.

## 오답노트

| Method | Endpoint | 인증 | 요청 | 응답 |
|---|---|---:|---|---|
| GET | `/quiz/incorrect/groups` | 예 | 없음 | `IncorrectNoteGroupResponse[]` |
| POST | `/quiz/incorrect/add-to-group` | 예 | `{ groupId, newGroupTitle, questionId }` | 빈 응답 |
| DELETE | `/quiz/incorrect/groups/{groupId}` | 예 | 없음 | 빈 응답 |
| DELETE | `/quiz/incorrect/groups/{groupId}/questions/{questionId}` | 예 | 없음 | 빈 응답 |
| GET | `/quiz/incorrect/groups/{groupId}/practice` | 예 | 없음 | `QuizSetDetailResponse` |
| GET | `/quiz/incorrect/summary` | 예 | 없음 | `IncorrectSummaryResponse` |
| GET | `/quiz/incorrect/statistics/courses` | 예 | 없음 | `CourseIncorrectStatResponse[]` |
| GET | `/quiz/incorrect/statistics/types` | 예 | 없음 | `QuestionTypeIncorrectStatResponse[]` |
| GET | `/quiz/incorrect/questions` | 예 | 없음 | `IncorrectQuestionStatResponse[]` |
| GET | `/quiz/incorrect/review-today` | 예 | query `limit`(기본 10), `courseId`(선택) | `TodayReviewQuestionResponse[]` |

## 파일

| Method | Endpoint | 인증 | 요청 | 응답 |
|---|---|---:|---|---|
| POST | `/upload/image` | 아니오 | multipart `file` | `{ url }` |
| POST | `/upload/file` | 아니오 | multipart `file` | `{ url, title }` |
| GET | `/upload/download/{fileName}` | 아니오 | query `originalName` | 파일 응답 |
