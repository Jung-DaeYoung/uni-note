# UniNote API

모든 경로는 `/api` 기준이다. `/auth/**`, `/upload/**`는 공개 경로이고, 그 외 API는 인증이 필요하다. 인증 요청은 `Authorization: Bearer <JWT>` 헤더를 사용한다.

## 인증·대시보드

| Method | Endpoint | 인증 | 요청 | 응답 |
|---|---|---:|---|---|
| POST | `/auth/login` | 아니오 | `{ studentNum, password }` | `{ token, studentNum }` |
| GET | `/dashboard/courses` | 예 | 없음 | `DashboardResponse` |
| POST | `/courses` | 예 | `{ courseName }` (최대 100자) | `CourseResponse`. 본인 소유 직접 생성 강의를 만든다 |
| PUT | `/courses/{courseId}` | 예 | `{ courseName }` | `CourseResponse`. 본인이 만든 강의만, 학교 강의는 403 |
| DELETE | `/courses/{courseId}` | 예 | 없음 | 빈 응답(204). 본인이 만든 강의만. 노트·하위 노트와 본인의 이 강의 퀴즈·풀이 기록·오답노트 항목도 함께 삭제 |

`DashboardResponse.courses`는 수강 강의 다음에 본인이 만든 강의를 붙여 반환한다. `CourseResponse`는 `courseId`, `courseName`, `courseCode`, `professorName`, `userCreated`를 가지며, 직접 생성 강의는 `courseCode`·`professorName`이 null이다. 직접 생성 강의에서는 노트·AI 퀴즈·오답노트를 그대로 쓸 수 있고(노트 API는 수강 또는 강의 소유자를 허용), 게시판은 403, 노트·퀴즈 공유는 400이다.

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
| GET | `/shared-quizzes/{sharedQuizId}/comments` | 예 | 없음 | `{ [questionId]: CommentResponse[] }` (문제별 댓글, 오래된 순, 수강생만) |
| POST | `/shared-quizzes/{sharedQuizId}/questions/{questionId}/comments` | 예 | `{ content }` (최대 255자) | `CommentResponse`. 이 글의 문제가 아니면 400 |
| PUT | `/shared-quizzes/comments/{commentId}` | 예 | `{ content }` | `CommentResponse`. 작성자만 |
| DELETE | `/shared-quizzes/comments/{commentId}` | 예 | 없음 | 빈 응답(204). 작성자만 |

`SharedQuizResponse`는 `sharedQuizId`, `quizSetId`(스냅샷), `courseId`, `courseName`, `title`, `difficulty`, `questionCount`, `authorName`(익명), `isAuthor`, `likeCount`, `viewCount`, `liked`, `createdAt`을 가진다. 공유 시 원본은 출처(`sourceNoteId`/`sourceBlockId`) 없이 소유자 없는 스냅샷으로 복사되므로 원문 보기가 제공되지 않고, 원본 삭제나 글 삭제가 다른 학생의 풀이 기록·오답노트에 영향을 주지 않는다.

## 노트 공유 게시판

| Method | Endpoint | 인증 | 요청 | 응답 |
|---|---|---:|---|---|
| GET | `/shared-notes` | 예 | query `courseId`(선택) | `SharedNoteResponse[]` (수강 중인 강의의 글, 최신순) |
| POST | `/shared-notes` | 예 | `{ rootNoteId }` (본인 노트) | 빈 응답. 노트와 모든 하위 노트를 스냅샷으로 복사. 이미 공유한 노트면 400 |
| GET | `/shared-notes/{postId}` | 예 | 없음 | `SharedNoteDetailResponse` (공유 시점 스냅샷 트리, 수강생만) |
| DELETE | `/shared-notes/{postId}` | 예 | 없음 | 빈 응답(204). 작성자만. 스냅샷·댓글도 함께 삭제 |
| GET | `/shared-notes/{postId}/comments` | 예 | 없음 | `CommentResponse[]` (오래된 순, 수강생만) |
| POST | `/shared-notes/{postId}/comments` | 예 | `{ content }` (최대 255자) | `CommentResponse` (수강생만) |
| PUT | `/shared-notes/comments/{commentId}` | 예 | `{ content }` | `CommentResponse`. 작성자만 |
| DELETE | `/shared-notes/comments/{commentId}` | 예 | 없음 | 빈 응답(204). 작성자만 |

`SharedNoteResponse`는 `sharedNotePostId`, `courseId`, `courseName`, `title`(공유 시점 루트 노트 제목), `authorName`(익명), `isAuthor`, `createdAt`을 가진다. `SharedNoteDetailResponse`는 같은 필드에 `notes`(`{ noteId, title, content, children }` 트리)를 더한다. `noteId`는 원본 노트 ID로, 본문 페이지 링크와 맞추는 용도이며 원본 노트 API(`/notes/{noteId}`)는 여전히 작성자만 접근할 수 있다. VIEW 전용이며 공유본을 수정하는 API는 없다.

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
| GET | `/quiz/incorrect/review-today` | 예 | query `limit`(기본 10), `courseId`(선택) | `TodayReviewQuestionResponse[]` (간격 반복: 한 번이라도 틀린 문제 중 `nextReviewAt`이 오늘 이전인 문제. 마지막 오답 이후 연속 정답 `streak`에 따라 1·3·7·14·30일 간격, 5회 연속 정답이면 제외) |

## 파일

| Method | Endpoint | 인증 | 요청 | 응답 |
|---|---|---:|---|---|
| POST | `/upload/image` | 아니오 | multipart `file` | `{ url }` |
| POST | `/upload/file` | 아니오 | multipart `file` | `{ url, title }` |
| GET | `/upload/download/{fileName}` | 아니오 | query `originalName` | 파일 응답 |
