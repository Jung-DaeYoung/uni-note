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

## 마이페이지

| Method | Endpoint | 인증 | 요청 | 응답 |
|---|---|---:|---|---|
| GET | `/mypage` | 예 | 없음 | `MyPageResponse`. 인증된 학번 본인의 데이터만 |

`MyPageResponse`는 `profile { name, studentNum }`, `semester { label, startDate, endDate }`, `summary { noteCount, quizSetCount, attemptCount, incorrectNoteCount, postCount, commentCount, sharedCount }`, `heatmap [{ date, count }]`, `courseProgress [{ courseId, courseName, noteCount, quizSetCount, attemptCount, lastActivityAt }]`, `recentActivities [{ type, title, occurredAt, courseId, targetId }]`, `myContents { recentNotes [{ noteId, courseId, title, updatedAt }], recentQuizzes [{ quizSetId, title, createdAt }], sharedNotes [{ postId, title, createdAt }], sharedQuizzes [{ sharedQuizId, title, createdAt }] }`를 가진다.

- 학기는 서울 날짜 기준 달력 규칙으로 정한다. 1학기는 3/1~6/30, 2학기는 9/1~12/31이다. 7~8월에는 그해 1학기, 1~2월에는 전년도 2학기를 반환한다.
- `summary`는 전체 누적이다. `commentCount`는 강의 게시판·공유 노트·공유 시험 댓글의 합이고, `sharedCount`는 공유 노트와 공유 시험의 합이다.
- `courseProgress`는 대시보드와 같은 강의 목록(수강 강의 + 직접 만든 강의)이며 활동이 없는 강의도 0으로 담는다. `lastActivityAt`은 노트 수정·퀴즈 생성·풀이 중 가장 최근 시각이고 없으면 `null`이다.
- `recentActivities`는 학기와 관계없이 최신순 20건이다. `type`은 `NOTE_CREATED`, `NOTE_UPDATED`(마지막 수정일이 생성일과 다를 때만), `POST_CREATED`, `COMMENT_CREATED`, `SHARED_NOTE_COMMENTED`, `SHARED_QUIZ_COMMENTED`, `QUIZ_GENERATED`, `QUIZ_ATTEMPTED`, `INCORRECT_NOTE_ADDED`, `NOTE_SHARED`, `QUIZ_SHARED`다. `title`은 40자를 넘으면 잘라서 `…`을 붙인다(오답노트 담기는 문제 텍스트).
- `targetId`는 type별 원천 ID다. 노트는 `noteId`, 게시글·댓글은 `postId`, 공유 노트·공유 노트 댓글은 공유 글 ID, 시험 공유·공유 시험 댓글은 `sharedQuizId`, 퀴즈 생성은 `quizSetId`, 풀이는 `attemptId`, 오답노트 담기는 오답 항목 ID다.
- `myContents.recentNotes`는 최근 수정한 노트 6개, `recentQuizzes`는 최근 생성한 퀴즈 6개, `sharedNotes`·`sharedQuizzes`는 최신순 20개다.
- `heatmap`은 학기 범위에서 활동이 있는 날만 날짜 오름차순으로 담는다. 활동은 노트 생성·수정, 게시글, 댓글, AI 퀴즈 생성, 퀴즈 풀이(복습 재풀이 포함), 오답노트 담기, 노트·시험 공유다.
- 노트는 생성일에 1회로 센다. 마지막 수정일이 생성일과 다르면 그날 1회를 더 센다. 삭제되거나 공유를 내린 활동은 집계하지 않는다.

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
| POST | `/quiz/generate` | 예 | `{ noteIds, typeCounts, difficulty, blockSelections?, learningObjectives?, focusConcepts?, referenceQuestions?, coverAllNotes? }` — `blockSelections: [{ noteId, blockIds }]`(선택)에 있는 노트는 해당 블록과 하위 블록만, 나머지 `noteIds` 노트는 전체로 생성. `noteId`는 `noteIds`에 포함되어야 하며 전체 블록은 최대 500개. `learningObjectives`(선택)는 문항이 평가할 학습 목표로 최대 5개, 항목당 1~100자. `focusConcepts`(선택)는 집중 출제할 개념(개념별 통계의 `conceptTag`)으로 최대 5개, 항목당 1~30자이며 같은 문제를 반복하지 않도록 비교·적용·오개념 판별 형태로 출제된다. `referenceQuestions`(선택)는 학습자가 틀린 문제 원문으로 최대 10개, 항목당 1~500자이며 같은 개념을 다른 형태로 바꿔 출제한다. `coverAllNotes`(선택)가 true이고 출처가 있는 노트가 2개 이상이며 총 문항 수 이상이면 노트마다 1문항 이상 출제하도록 요청하고, 빠진 노트가 있으면 1회 재생성한다(그래도 빠지면 그대로 저장) | `QuizResponse` |
| GET | `/quiz/my` | 예 | 없음 | `QuizSetResponse[]` |
| GET | `/quiz/{quizSetId}` | 예 | 없음 | `QuizSetDetailResponse` |
| DELETE | `/quiz/{quizSetId}` | 예 | 없음 | 빈 응답 |
| POST | `/quiz/attempts` | 예 | `{ quizSetId, userAnswers[] }` | 빈 응답 |
| GET | `/quiz/attempts/my` | 예 | 없음 | `QuizAttemptResponse[]` |
| GET | `/quiz/attempts/{attemptId}` | 예 | 없음 | `QuizAttemptDetailResponse` |
| DELETE | `/quiz/attempts/{attemptId}` | 예 | 없음 | 빈 응답(204). 답안도 함께 삭제되어 오답 통계에서 빠진다 |
| GET | `/quiz/{quizSetId}/attempts` | 예 | 없음 | `QuizAttemptResponse[]` |

`userAnswers[]`의 항목은 `questionId`, `submittedAnswer`, `isCorrect`를 가진다.

문제 응답(`QuestionResponse`)은 `questionId`, `type`, `questionText`, `options`, `correctAnswer`, `explanation`, `sourceNoteId`, `sourceBlockId`, `conceptTags`를 가진다. `conceptTags`는 문항이 평가하는 핵심 개념(최대 3개)이며 AI가 생성하고 서버가 공백·중복을 정리한다. 태그 도입 전 문제는 빈 배열이다. 공유 시험 스냅샷에도 복사된다.

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
| GET | `/quiz/incorrect/statistics/concepts` | 예 | 없음 | `ConceptStatResponse[]` (강의·개념 태그별 풀이 통계, 취약 개념 먼저) |
| GET | `/quiz/incorrect/review-today` | 예 | query `limit`(기본 10), `courseId`(선택), `withinDays`(기본 0, 0~13: 오늘 + 이 일수까지 복습일이 오는 문제 포함) | `TodayReviewQuestionResponse[]` (간격 반복: 한 번이라도 틀린 문제 중 `nextReviewAt`이 오늘 이전인 문제. 마지막 오답 이후 연속 정답 `streak`에 따라 1·3·7·14·30일 간격, 5회 연속 정답이면 제외) |
| GET | `/quiz/incorrect/recent` | 예 | query `limit`(기본 10, 1~100), `courseId`(선택) | `QuestionResponse[]` (한 번 이상 틀린 문제, 마지막 오답이 최근인 순) |

`ConceptStatResponse`는 `conceptTag`, `courseId`, `courseName`, `questionCount`, `attemptCount`, `correctCount`, `incorrectCount`, `accuracyRate`, `reviewPriority`를 가진다. 같은 표기도 강의가 다르면 다른 개념으로 집계하고, 태그는 대소문자를 무시해 묶어 가장 먼저 만든 문제의 표기를 쓴다. 태그가 여럿인 문제는 각 태그에 풀이가 모두 더해지고, 태그가 없는 문제는 제외된다. 취약도(`reviewPriority`)와 정렬은 출처 블록 통계와 같다.

## 키워드 설명

| Method | Endpoint | 인증 | 요청 | 응답 |
|---|---|---:|---|---|
| POST | `/keywords/explain` | 예 | `{ keyword, context?, courseId?, noteId?, blockId? }` — `keyword` 1~80자, `context`(선택한 블록의 텍스트) 2,000자 이하. `noteId`가 있으면 본인 노트인지 확인(404/403). 학생별 10분에 20회(초과 시 429) | `KeywordExplainResponse` |
| GET | `/keywords/mentions` | 예 | query `keyword`(1~80자), `courseId`(필수). 누락·길이 초과는 400 `INVALID_REQUEST` | `KeywordMentionResponse[]` (`noteId`, `noteTitle`, `blockId`, `preview`). 요청 학생의 해당 강의 노트 중 검색용 평문(`searchContent`)에 키워드가 든 노트를 최근 수정 순으로 찾고, 본문의 최상위 블록 단위로 최대 10개. `blockId`가 없는 옛 블록은 null, 미리보기는 일치 위치 앞뒤 40자. `searchContent`가 비어 있는 노트는 찾지 못한다 |

`KeywordExplainResponse`는 `keyword`, `summary`(3줄 요약), `easyExplanation`, `advancedExplanation`, `relatedKeywords`(최대 5개), `resources`(최대 3개, `{ title, url, source, reason }`)를 가진다. `url`은 AI가 만든 주소가 아니라 서버가 허용 사이트(한국어·영어 위키백과, MDN, Google Scholar)의 검색 URL에 AI가 고른 검색어를 넣어 만든 링크다. AI 호출 실패·응답 형식 오류·빈 설명은 503(`EXTERNAL_SERVICE_ERROR`/`AI_RESPONSE_INVALID`)이다.

## 파일

| Method | Endpoint | 인증 | 요청 | 응답 |
|---|---|---:|---|---|
| POST | `/upload/image` | 아니오 | multipart `file` | `{ url }` |
| POST | `/upload/file` | 아니오 | multipart `file` | `{ url, title }` |
| GET | `/upload/download/{fileName}` | 아니오 | query `originalName` | 파일 응답 |
