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
| `Question` / `questions` | `questionId` PK, `type`, `questionText`, `options`, `correctAnswer`, `explanation`, `sourceNoteId`, `sourceBlockId` | `QuizSet` N:1 |
| `QuizAttempt` / `quiz_attempts` | `attemptId` PK, `score`, `status`, `startTime`, `endTime` | `QuizSet` N:1, `Student` N:1, `UserAnswer` 1:N |
| `UserAnswer` / `user_answers` | `userAnswerId` PK, `submittedAnswer`, `isCorrect` | `QuizAttempt` N:1, `Question` N:1 |

## CBT 시험 공유게시판

| Entity / 테이블 | 주요 필드 | 관계 |
|---|---|---|
| `SharedQuiz` / `shared_quizzes` | `sharedQuizId` PK, `sourceQuizSetId`(원본 ID, FK 아님, unique), `likeCount`, `viewCount`, 생성 시각 | `QuizSet`(스냅샷) 1:1 unique, `Student`(작성자) N:1, `Course` N:1, `SharedQuizLike` 1:N |
| `SharedQuizLike` / `shared_quiz_likes` | `id` PK | `SharedQuiz` N:1, `Student` N:1; 글·학생 unique |
| `SharedQuizComment` / `shared_quiz_comments` | `commentId` PK, `content`(255), 생성 시각 | `SharedQuiz` N:1(글 삭제 시 함께 삭제), `Question`(스냅샷 문제) N:1, `Student` N:1 |

공유 시 원본 `QuizSet`·`Question`을 복사한 스냅샷을 저장한다. 스냅샷 `QuizSet.student`는 null(소유자 없음)이고 `Question`의 출처 필드는 비운다. 글을 삭제해도 스냅샷은 남아 다른 학생의 풀이 기록·오답노트가 계속 참조한다.

운영(`ddl-auto: validate`) 배포 전 실행할 DDL:

```sql
CREATE TABLE shared_quizzes (
    shared_quiz_id BIGINT NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6),
    like_count INTEGER NOT NULL,
    source_quiz_set_id BIGINT NOT NULL,
    view_count INTEGER NOT NULL,
    course_id BIGINT NOT NULL,
    quiz_set_id BIGINT NOT NULL,
    stud_id BIGINT NOT NULL,
    PRIMARY KEY (shared_quiz_id),
    UNIQUE (source_quiz_set_id),
    UNIQUE (quiz_set_id),
    FOREIGN KEY (course_id) REFERENCES courses (course_id),
    FOREIGN KEY (quiz_set_id) REFERENCES quiz_sets (quiz_set_id),
    FOREIGN KEY (stud_id) REFERENCES students (stud_id)
) ENGINE=InnoDB;

CREATE TABLE shared_quiz_likes (
    id BIGINT NOT NULL AUTO_INCREMENT,
    shared_quiz_id BIGINT NOT NULL,
    stud_id BIGINT NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (shared_quiz_id, stud_id),
    FOREIGN KEY (shared_quiz_id) REFERENCES shared_quizzes (shared_quiz_id),
    FOREIGN KEY (stud_id) REFERENCES students (stud_id)
) ENGINE=InnoDB;

CREATE TABLE shared_quiz_comments (
    comment_id BIGINT NOT NULL AUTO_INCREMENT,
    content VARCHAR(255) NOT NULL,
    created_at DATETIME(6),
    question_id BIGINT NOT NULL,
    shared_quiz_id BIGINT NOT NULL,
    stud_id BIGINT NOT NULL,
    PRIMARY KEY (comment_id),
    FOREIGN KEY (question_id) REFERENCES questions (question_id),
    FOREIGN KEY (shared_quiz_id) REFERENCES shared_quizzes (shared_quiz_id),
    FOREIGN KEY (stud_id) REFERENCES students (stud_id)
) ENGINE=InnoDB;
```

## 노트 공유 게시판

| Entity / 테이블 | 주요 필드 | 관계 |
|---|---|---|
| `SharedNotePost` / `shared_note_posts` | `sharedNotePostId` PK, `sourceRootNoteId`(원본 ID, FK 아님, unique), `title`, 생성 시각 | `Student`(작성자) N:1, `Course` N:1, `SharedNoteSnapshot`·`SharedNoteComment` 1:N(글 삭제 시 함께 삭제) |
| `SharedNoteSnapshot` / `shared_note_snapshots` | `snapshotId` PK, `originalNoteId`, `parentOriginalNoteId`(루트는 null), `title`, `content`(Tiptap JSON) | `SharedNotePost` N:1 |
| `SharedNoteComment` / `shared_note_comments` | `commentId` PK, `content`(255), 생성 시각 | `SharedNotePost` N:1, `Student` N:1 |

공유 시 노트와 모든 하위 노트를 스냅샷으로 복사하므로 원본 수정·삭제가 공유본에 영향을 주지 않는다. 스냅샷의 부모 관계는 자기참조 FK 대신 원본 노트 ID 값으로 보관하고 조회 시 메모리에서 트리를 조립한다.

운영(`ddl-auto: validate`) 배포 전 실행할 DDL:

```sql
CREATE TABLE shared_note_posts (
    shared_note_post_id BIGINT NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6),
    source_root_note_id BIGINT NOT NULL,
    title VARCHAR(255),
    course_id BIGINT NOT NULL,
    stud_id BIGINT NOT NULL,
    PRIMARY KEY (shared_note_post_id),
    UNIQUE (source_root_note_id),
    FOREIGN KEY (course_id) REFERENCES courses (course_id),
    FOREIGN KEY (stud_id) REFERENCES students (stud_id)
) ENGINE=InnoDB;

CREATE TABLE shared_note_snapshots (
    snapshot_id BIGINT NOT NULL AUTO_INCREMENT,
    content LONGTEXT,
    original_note_id BIGINT NOT NULL,
    parent_original_note_id BIGINT,
    title VARCHAR(255),
    shared_note_post_id BIGINT NOT NULL,
    PRIMARY KEY (snapshot_id),
    FOREIGN KEY (shared_note_post_id) REFERENCES shared_note_posts (shared_note_post_id)
) ENGINE=InnoDB;

CREATE TABLE shared_note_comments (
    comment_id BIGINT NOT NULL AUTO_INCREMENT,
    content VARCHAR(255) NOT NULL,
    created_at DATETIME(6),
    shared_note_post_id BIGINT NOT NULL,
    stud_id BIGINT NOT NULL,
    PRIMARY KEY (comment_id),
    FOREIGN KEY (shared_note_post_id) REFERENCES shared_note_posts (shared_note_post_id),
    FOREIGN KEY (stud_id) REFERENCES students (stud_id)
) ENGINE=InnoDB;
```

## 오답노트

| Entity / 테이블 | 주요 필드 | 관계 |
|---|---|---|
| `IncorrectNoteGroup` / `incorrect_note_groups` | `id` PK, `title`, 생성 시각 | `Student` N:1, `IncorrectNoteItem` 1:N; 학생·제목 unique |
| `IncorrectNoteItem` / `incorrect_note_items` | `id` PK, 추가 시각 | `IncorrectNoteGroup` N:1, `Question` N:1; 그룹·문항 unique |

오답노트는 기존 `Question`을 그룹에 연결하며 별도 문항 내용을 복제하지 않는다.
