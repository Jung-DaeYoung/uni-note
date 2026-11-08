# UniNote 데이터베이스 구조

Entity는 JPA로 관리되며 기본 키는 자동 증가 ID다. 실제 테이블명은 Entity의 `@Table` 설정을 따른다.

## 사용자·강의

| Entity / 테이블 | 주요 필드 | 관계 |
|---|---|---|
| `Student` / `students` | `studId` PK, `studentNum` unique, `name`, `password` | 노트·게시글·수강·퀴즈·오답그룹의 학생 |
| `Professor` / `professors` | `profId` PK, 교수 정보 | `Course`의 담당 교수 |
| `Course` / `courses` | `courseId` PK, `courseName`, `courseCode` unique(nullable), `userCreated` | `Professor` N:1(직접 생성 강의는 null), `Student`(`owner`, 직접 생성 강의 소유자) N:1, 다른 기능의 강의 기준 |
| `Enrollment` / `enrollments` | `enrollId` PK, `academicYear`(1~4), `semester`(1·2), unique(`stud_id`, `course_id`) | `Student` N:1, `Course` N:1 |

직접 생성 강의(`userCreated = true`)는 소유자에게 `Enrollment`를 만들지 않는다. 노트 접근은 수강 또는 소유자로 허용한다. 삭제 시 소유자의 이 강의 퀴즈 → 루트 노트(하위 노트 cascade) → 강의 순으로 지운다.

운영(`ddl-auto: validate`) 배포 전 실행할 DDL:

```sql
ALTER TABLE courses
    ADD COLUMN owner_stud_id BIGINT NULL,
    ADD COLUMN user_created BIT(1) NOT NULL DEFAULT 0,
    ADD FOREIGN KEY (owner_stud_id) REFERENCES students (stud_id);
```

### 학년·학기별 수강

수강(`Enrollment`)은 학교 시스템이 등록한다고 보고, 앱에는 등록 API가 없다. 각 수강에 학년·학기를 두고, 한 강의는 학생당 한 학기에만 둔다(재수강 미지원). 현재 학기는 저장하지 않고 수강 중 가장 늦은 학년·학기로 본다. 지난 학기 강의도 `Enrollment`가 있으므로 노트·게시판 접근은 그대로다.

운영(`ddl-auto: validate`) 배포 전 실행할 DDL. 기존 수강은 4학년 1학기로 옮긴다:

```sql
ALTER TABLE enrollments
    ADD COLUMN academic_year INT NULL,
    ADD COLUMN semester INT NULL;
-- 로컬은 ddl-auto: update가 컬럼을 먼저 만들며 기존 행을 0으로 채운다.
UPDATE enrollments SET academic_year = 4, semester = 1 WHERE academic_year IS NULL OR academic_year = 0;
ALTER TABLE enrollments
    MODIFY academic_year INT NOT NULL,
    MODIFY semester INT NOT NULL,
    ADD UNIQUE KEY uk_enroll_student_course (stud_id, course_id);
```

학기별 강의 시드(1~3학년은 임의, 4학년 2학기는 지정 강의). `course_code`·수강 유니크 키로 다시 실행해도 중복되지 않는다. 교수는 기존 `professors`의 이름으로 찾는다:

```sql
SET @stud = (SELECT stud_id FROM students WHERE student_num = '<학번>');

CREATE TEMPORARY TABLE seed_courses (name VARCHAR(255), code VARCHAR(255), prof VARCHAR(255), y INT, s INT);
INSERT INTO seed_courses VALUES
  ('컴퓨터개론', 'CSE111', '김현수', 1, 1),
  ('C프로그래밍', 'CSE112', '김지수', 1, 1),
  ('대학수학', 'MATH111', '김현수', 1, 1),
  ('객체지향프로그래밍', 'CSE121', '김지수', 1, 2),
  ('논리회로', 'CSE122', '신홍철', 1, 2),
  ('자바프로그래밍', 'CSE211', '최권택', 2, 1),
  ('컴퓨터구조', 'CSE212', '신홍철', 2, 1),
  ('선형대수', 'MATH211', '김현수', 2, 1),
  ('운영체제', 'CSE221', '신홍철', 2, 2),
  ('데이터베이스', 'CSE222', '최권택', 2, 2),
  ('확률과통계', 'MATH221', '김현수', 2, 2),
  ('컴퓨터네트워크', 'CSE311', '신홍철', 3, 1),
  ('웹프로그래밍', 'CSE312', '김지수', 3, 1),
  ('인공지능', 'CSE321', '양재형', 3, 2),
  ('모바일프로그래밍', 'CSE322', '김지수', 3, 2),
  ('컴파일러', 'CSE323', '양재형', 3, 2),
  ('캡스톤디자인Ⅱ', 'CSE421', '양재형', 4, 2),
  ('소프트웨어공학', 'CSE422', '양재형', 4, 2),
  ('자료구조와 알고리즘', 'CSE423', '김지수', 4, 2),
  ('통계응용', 'MATH421', '김현수', 4, 2);

INSERT IGNORE INTO courses (course_name, course_code, prof_id, user_created)
SELECT v.name, v.code, p.prof_id, 0 FROM seed_courses v LEFT JOIN professors p ON p.name = v.prof;

INSERT IGNORE INTO enrollments (stud_id, course_id, academic_year, semester)
SELECT @stud, c.course_id, v.y, v.s FROM seed_courses v JOIN courses c ON c.course_code = v.code
WHERE @stud IS NOT NULL;

DROP TEMPORARY TABLE seed_courses;
```

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
| `Question` / `questions` | `questionId` PK, `type`, `questionText`, `options`, `correctAnswer`, `explanation`, `sourceNoteId`, `sourceBlockId`, `conceptTags` | `QuizSet` N:1 |
| `QuizAttempt` / `quiz_attempts` | `attemptId` PK, `score`, `status`, `startTime`, `endTime` | `QuizSet` N:1, `Student` N:1, `UserAnswer` 1:N |
| `UserAnswer` / `user_answers` | `userAnswerId` PK, `submittedAnswer`, `isCorrect` | `QuizAttempt` N:1, `Question` N:1 |

`Question.options`와 `conceptTags`는 JSON 문자열 배열(TEXT)이다. `conceptTags`는 문항이 평가하는 핵심 개념(최대 3개)이고, 도입 전에 만든 문제는 null이다.

운영(`ddl-auto: validate`) 배포 전 실행할 DDL:

```sql
ALTER TABLE questions ADD COLUMN concept_tags TEXT NULL;
```

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
