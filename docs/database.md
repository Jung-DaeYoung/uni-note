# UniNote 데이터베이스 구조

Entity는 JPA로 관리되며 기본 키는 자동 증가 ID다. 실제 테이블명은 Entity의 `@Table` 설정을 따른다.

## 사용자·강의

| Entity / 테이블 | 주요 필드 | 관계 |
|---|---|---|
| `Student` / `students` | `studId` PK, `studentNum` unique, `name`, `password` | 노트·게시글·수강·퀴즈·오답그룹의 학생 |
| `Professor` / `professors` | `profId` PK, 교수 정보 | `Course`의 담당 교수 |
| `Course` / `courses` | `courseId` PK, `courseName`, `courseCode` unique | `Professor` N:1, 다른 기능의 강의 기준 |
| `Enrollment` / `enrollments` | `enrollId` PK | `Student` N:1, `Course` N:1 |

## 노트·게시판

| Entity / 테이블 | 주요 필드 | 관계 |
|---|---|---|
| `Note` / `notes` | `noteId` PK, `title`, `content`, `previewText`, `searchContent`, 생성·수정 시각 | `Course` N:1, `Student` N:1, 자기참조 부모-자식 |
| `Post` / `posts` | `postId` PK, `title`, `content`, `anonymous`, 생성 시각 | `Course` N:1, `Student` N:1, `Comment` 1:N |
| `Comment` | 댓글 ID, 내용, 작성 시각 | `Post` N:1, `Student` N:1 |

`Note.parentNote`와 `childNotes`가 노트 트리를 구성한다. 게시글과 댓글의 학생 관계는 내부 작성자 확인에 사용되며 표시 방식은 API 응답에서 처리한다.

## 퀴즈·풀이

| Entity / 테이블 | 주요 필드 | 관계 |
|---|---|---|
| `QuizSet` / `quiz_sets` | `quizSetId` PK, `title`, `difficulty`, `sourceNotes`, 생성 시각 | `Course` N:1, `Student` N:1, `Question` 1:N, `QuizAttempt` 1:N |
| `Question` / `questions` | `questionId` PK, `type`, `questionText`, `imagePath`, `options`, `correctAnswer`, `explanation`, `sourceNoteId`, `sourceBlockId` | `QuizSet` N:1 |
| `QuizAttempt` / `quiz_attempts` | `attemptId` PK, `score`, `status`, `startTime`, `endTime` | `QuizSet` N:1, `Student` N:1, `UserAnswer` 1:N |
| `UserAnswer` / `user_answers` | `userAnswerId` PK, `submittedAnswer`, `isCorrect` | `QuizAttempt` N:1, `Question` N:1 |

## 오답노트

| Entity / 테이블 | 주요 필드 | 관계 |
|---|---|---|
| `IncorrectNoteGroup` / `incorrect_note_groups` | `id` PK, `title`, 생성 시각 | `Student` N:1, `IncorrectNoteItem` 1:N; 학생·제목 unique |
| `IncorrectNoteItem` / `incorrect_note_items` | `id` PK, 추가 시각 | `IncorrectNoteGroup` N:1, `Question` N:1; 그룹·문항 unique |

오답노트는 기존 `Question`을 그룹에 연결하며 별도 문항 내용을 복제하지 않는다.
