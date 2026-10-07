# UniNote 사용자 직접 생성 강의 구현 계획

## 문제와 목표

현재 UniNote의 `Course`는 교수·강의 정보와 연결되고, 사용자의 접근은 `Enrollment`를 통해 확인된다. `Note`는 반드시 강의와 학생을 보유하며, `NoteService`의 생성·조회·수정·삭제 경로가 수강 여부와 노트 소유권을 검증한다.

새 기능은 기존 수강 강의와 별도로 사용자가 자신의 강의를 생성하고, 해당 강의에서 기존 노트/하위 노트 기능을 그대로 사용하도록 만드는 것이다. 기존 수강 강의 데이터와 API 계약은 보존하고, 향후 노트 공유 게시판에서 직접 생성 강의의 공유 정책을 별도로 확장할 수 있어야 한다.

확정된 정책:

- `Course`에 소유자(`owner: Student`)와 직접 생성 여부(`userCreated`)를 추가한다.
- 직접 생성 강의는 강의명만 입력한다. 강의코드·교수는 사용하지 않는다.
- 소유자에게 `Enrollment`를 생성하지 않는다. 기존 수강권과 소유권을 별도로 구분한다.
- 직접 생성 강의의 생성·수정·삭제는 소유자 본인만 가능하다.
- 삭제는 현재 강의와 그 강의의 노트·하위 노트를 cascade 영구 삭제한다.
- 직접 생성 강의의 향후 노트 공유 공개 범위는 이번 기능에서 고정하지 않고, 공유 게시판 정책에서 별도 결정한다. 이번 범위에서는 직접 생성 강의의 노트·퀴즈 공유를 막는다(서버 400, 노트 공유 버튼 숨김).
- 강의명 중복은 허용한다(unique 제약 없음).
- 직접 생성 강의에는 커뮤니티 게시판을 제공하지 않는다(커뮤니티 버튼 숨김).
- 강의 삭제 시 소유자의 해당 강의 퀴즈·풀이 기록·오답노트 항목도 함께 영구 삭제한다. soft delete는 하지 않는다.

## 현재 코드 분석

### Course, Enrollment, Student

- `Course`는 `courseId`, `courseName`, `courseCode`, `professor`를 가진다.
- `Enrollment`는 `Student`와 `Course`의 수강 관계만 표현하며 별도 unique 제약이나 소유권 필드는 없다.
- `Student`가 사용자 엔티티이며 JWT principal은 학번(`studentNum`)이다.
- `CourseRepository`와 `EnrollmentRepository`는 기본 CRUD와 학생별 수강 목록/수강 여부 조회만 제공한다.
- `DashboardService`는 `enrollmentRepository.findByStudent(student)` 결과만 대시보드 강의 목록으로 반환한다. 현재 직접 생성 강의는 목록에 포함될 수 없다.
- `DashboardService`는 `enrollment.getCourse().getProfessor().getName()`을 그대로 호출하므로, 교수가 null인 직접 생성 강의가 섞이면 NPE로 대시보드 전체가 500이 된다. 서버에서 null 안전하게 변환해야 한다.
- `course_code`는 이미 unique·nullable이다. MySQL unique는 NULL 중복을 허용하므로 직접 생성 강의의 null 강의코드는 문제없다.

### Note와 권한

- `Note`는 `Course`, `Student`, `parentNote`, `childNotes`, Tiptap `content`, `previewText`, `searchContent`를 가진다.
- `NoteService.getNote`, `saveNote`, `deleteNote`는 `validateOwnership`으로 노트 작성자 본인을 확인한다.
- `NoteService.getNoteTree`, `createNote`, `deleteNote`는 `validateEnrollment`로 해당 강의 수강 여부를 확인한다.
- `createNote`의 부모 검증은 부모 노트의 강의와 학생 소유권을 확인한다.
- 따라서 직접 생성 강의 소유자가 Enrollment 없이 노트를 사용하려면, `NoteService`의 수강 검증을 소유자 강의에는 허용하는 공통 권한 규칙으로 확장해야 한다. 기존 수강 강의의 본인 노트 권한은 그대로 유지한다.
- 기존 `Note`의 `course_id`, `stud_id`, `parent_note_id` 구조를 변경하지 않고 재사용할 수 있다.

### Frontend 강의 흐름

- `CourseContext`는 `/api/dashboard/courses`의 `courses`만 보관하며 `AppLayout` 사이드바와 `DashboardPage`가 이를 함께 사용한다.
- `DashboardPage`는 수강 중인 강의 카드만 표시하고, `CourseDetailPage`는 `/course/{courseId}`와 `/course/{courseId}/note/{noteId}` 경로로 기존 노트 UI를 제공한다.
- `useCourseNotes`는 강의 ID로 트리 조회·노트 생성·삭제를 수행하고, `NotionEditor`는 동일한 `courseId`를 사용해 하위 노트를 생성하고 자동 저장한다.
- `AppLayout` 사이드바의 강의 목록도 `CourseContext.courses`에 의존하므로, API 응답에 강의 유형을 추가하면 기존 카드·메뉴에서 수강 강의와 직접 생성 강의를 구분할 수 있다.
- `CourseContext.courses`는 `SharedQuizBoardPage`·`SharedNoteBoardPage`의 강의 필터에도 쓰인다. 직접 생성 강의를 필터로 고르면 수강 검증에서 403이 나므로 필터에서 제외한다.
- `CourseDetailPage`의 "커뮤니티" 버튼은 `PostService`(수강 검증)를 호출하므로 직접 생성 강의에서는 숨긴다. "노트 공유" 버튼도 숨긴다.

### 수강 검증 위치

`enrollmentRepository.existsByStudentAndCourse_CourseId`/`findByStudent`를 쓰는 곳은 다음뿐이다.

- `NoteService.validateEnrollment`: 직접 생성 강의 소유자도 허용하도록 변경한다.
- `DashboardService`: 수강 강의에 본인 직접 생성 강의를 더해 반환하도록 변경한다.
- `PostService`, `SharedQuizService`, `SharedNoteService`: 소유자는 수강생이 아니므로 직접 생성 강의를 자동으로 차단한다. 이번 범위에서는 그대로 둔다(공유는 아래처럼 400 메시지만 먼저 반환).
- `QuizService`, `IncorrectNoteService`는 수강 여부가 아니라 노트·퀴즈 소유권만 검사하므로(`validateOwnership`, `validateSameCourse`) 직접 생성 강의에서도 수정 없이 동작한다.

## 구현 계획

### 1. 데이터 구조 변경

#### `Course` 확장

- `owner`:
  - `@ManyToOne(fetch = FetchType.LAZY)`
  - `@JoinColumn(name = "owner_stud_id")`
  - 직접 생성 강의의 소유자
  - 기존 시스템 강의는 null일 수 있도록 nullable 허용
- `userCreated`:
  - `@Column(nullable = false)`
  - 직접 생성 강의면 true, 기존 수강 강의면 false
  - 기존 데이터 migration 시 기본값 false로 채운다.
- 기존 `professor`는 nullable을 유지한다. 직접 생성 강의는 교수 없이 저장한다.
- `courseCode`도 직접 생성 강의에서는 null을 허용한다.

응답 DTO에는 다음 표시용 필드를 추가한다.

- `userCreated`
- 목록에는 본인이 만든 직접 생성 강의만 나오므로 `ownedByMe`는 항상 `userCreated`와 같다. 별도 필드를 두지 않는다.
- 직접 생성 강의에서는 `professorName`과 `courseCode`가 null이므로 서버는 null로 내려주고, 프론트는 “내 강의” 표시를 사용한다.

#### 관계와 삭제

- `courses`를 FK로 참조하는 테이블은 `enrollments`, `notes`, `posts`, `quiz_sets`, `shared_quizzes`, `shared_note_posts`다.
- 직접 생성 강의는 게시판·공유를 막으므로 `notes`와 소유자의 `quiz_sets`만 참조한다. Enrollment도 만들지 않는다.
- `Course.notes` 관계는 추가하지 않고 `CourseService.deleteUserCourse`에서 삭제 순서를 명시적으로 처리한다.
  1. 소유자의 해당 강의 퀴즈마다 기존 `QuizService.deleteQuiz`를 호출한다(오답노트 항목·가상 세션 답안 정리 후 QuizSet 삭제, 풀이 기록은 cascade).
  2. 해당 강의의 루트 노트를 삭제한다. 하위 노트는 `Note.childNotes`의 `cascade = ALL, orphanRemoval = true`로 함께 삭제된다.
  3. 강의를 삭제한다.
- 실제 삭제 동작은 퀴즈·오답노트가 있는 상태에서 통합 테스트로 확인한다.

#### 기존 데이터 migration

- 기존 `courses` 행은 `user_created = false`, `owner_stud_id = null`로 초기화한다.
- `user_created`는 `NOT NULL` 적용 전 기존 행에 기본값을 채운다.
- 운영은 `ddl-auto: validate`이므로 기존 방식대로 `docs/database.md`에 DDL을 기록하고 배포 전 실행한다.

```sql
ALTER TABLE courses
    ADD COLUMN owner_stud_id BIGINT NULL,
    ADD COLUMN user_created BIT(1) NOT NULL DEFAULT 0,
    ADD FOREIGN KEY (owner_stud_id) REFERENCES students (stud_id);
```
- 로컬은 `ddl-auto: update`이므로 개발 재기동 시 컬럼 생성 여부를 확인할 수 있지만, 운영 적용 절차의 대체로 사용하지 않는다.

### 2. Backend API/Service

#### API 초안

- `GET /api/dashboard/courses`
  - 기존 응답을 유지하면서 `courses`에 직접 생성 강의를 더하고 각 항목에 `userCreated`를 추가한다.
  - 기존 프론트 계약을 깨지 않도록 `courses` 필드명은 유지한다.
- 새 `CourseController`의 `/api/courses`, `/api/courses/{courseId}`는 기존 `NoteController`의 `/api/courses/{courseId}/notes...`와 경로가 겹치지 않는다. 요청 DTO는 `CourseRequest { @NotBlank @Size(max = 100) courseName }`.
- `POST /api/courses`
  - 요청: `{ courseName }`
  - 현재 인증 사용자를 `owner`로 저장하고 `userCreated=true`, `professor=null`, `courseCode=null`로 생성한다.
- `PUT /api/courses/{courseId}`
  - 요청: `{ courseName }`
  - 직접 생성 강의 소유자 본인만 수정 가능하다.
- `DELETE /api/courses/{courseId}`
  - 직접 생성 강의 소유자 본인만 삭제 가능하다.
  - 하위 노트를 포함한 해당 강의 노트를 삭제한 후 강의를 삭제한다.
- `GET /api/courses/{courseId}`는 현재 강의 상세 화면이 별도 호출하지 않으므로 초기 범위에서 추가하지 않는다. 필요해질 때 소유권·수강권을 함께 반환하는 상세 API로 확장한다.

#### 서비스 구조

- `CourseService`를 새로 두어 직접 생성·수정·삭제를 담당한다. 강의 접근 판정은 바뀌는 곳이 `NoteService` 하나뿐이므로 별도 공통 컴포넌트로 빼지 않는다.
- `DashboardService`는 `CourseRepository`(소유자 기준 조회)를 이용해 기존 수강 강의와 본인 직접 생성 강의를 합쳐 반환하고, 교수명은 null 안전하게 변환한다.
- `SharedQuizService.share`, `SharedNoteService.share`는 `course.userCreated`면 "직접 만든 강의는 공유할 수 없습니다"(400)를 먼저 반환한다. 지금은 수강 검증에 걸려 "해당 강의를 수강하지 않습니다"(403)가 나온다.
- 기존 `NoteService`의 `validateEnrollment`를 다음 규칙으로 교체한다.
  1. 학생이 해당 강의를 수강 중이면 허용
  2. 강의가 `userCreated=true`이고 `course.owner == student`이면 허용
  3. 그 외에는 `CourseAccessException`(403)
- 노트 생성·트리 조회·노트 삭제·하위 노트 생성이 모두 동일 규칙을 사용하게 한다.
- 노트 자체 수정은 기존 `validateOwnership`을 유지한다.
- 직접 생성 강의 생성 API는 `Authentication`/`@AuthenticationPrincipal`의 학번을 기존 서비스 방식으로 Student 조회에 사용한다.

#### 강의 삭제 순서

1. `Course`를 조회한다.
2. `userCreated=true`인지 확인한다. 시스템 강의 삭제 요청은 403 또는 별도 invalid request로 차단한다.
3. 현재 사용자가 `owner`인지 확인한다.
4. 소유자의 해당 강의 퀴즈를 `QuizService.deleteQuiz`로 삭제한다(공유는 막혀 있으므로 공유 게시글·스냅샷은 없다).
5. 해당 강의의 루트 노트를 삭제한다(하위 노트 cascade).
6. 직접 생성 강의를 삭제한다.

### 3. Frontend UI/강의 구분

#### Dashboard와 Sidebar

- 대시보드에는 직접 생성 강의를 표시하지 않는다. "수강 중인 강의" 카드에는 `userCreated=false`인 강의만 보여 준다(기존 강의코드·교수명·이동 동작 유지).
- `AppLayout` 사이드바 메뉴 이름을 "현재강의목록"에서 "강의목록"으로 바꾸고, 그 아래를 `CourseResponse.userCreated` 기준으로 두 그룹으로 나눈다. 클릭 경로는 기존 `/course/{courseId}`를 재사용한다.
  - `수강 중인 강의`: 비어 있으면 "수강 중인 강의 없음"
  - `내가 만든 강의`: 그룹 제목 옆에 `+` 버튼
- `CourseContext`는 전체 강의 목록과 기존 최근 노트/게시글 데이터를 계속 한 번의 요청으로 관리한다.

#### 강의 생성·수정·삭제 UI

- 생성은 사이드바 "내가 만든 강의" 옆 `+` 버튼으로 한다. VS Code에서 새 파일을 만들 때처럼 목록 안에 이름 입력칸이 나타난다.
  - Enter 또는 이름을 입력한 채 포커스를 옮기면 생성하고 그 강의로 이동한다.
  - Esc를 누르거나 빈 채로 포커스를 옮기면 취소한다.
  - 실패하면 서버 메시지를 알리고 입력칸을 남겨 이름을 고칠 수 있게 한다.
  - Enter 뒤에 이어지는 blur로 두 번 생성되지 않게 막는다.
- 입력값은 강의명 하나로 제한한다(최대 100자).
- 직접 생성 강의 상세 화면의 헤더에 "이름 변경"(입력 창)·"강의 삭제" 버튼을 표시한다.
- 수강 강의에는 해당 버튼을 표시하지 않는다.
- 삭제 전 하위 노트와 이 강의의 퀴즈·풀이 기록·오답노트 항목까지 삭제된다는 확인 문구를 표시한다.
- 직접 생성 강의에서는 `CourseDetailPage`의 "커뮤니티"·"노트 공유" 버튼을 숨긴다.
- 직접 생성 강의에서는 게시판 게시글도 불러오지 않는다(`useCourseBoard`의 `enabled`). 불러오면 서버 403에 `client.js`의 공통 처리(알림 후 대시보드 이동)가 걸려 강의 화면에서 튕긴다. 강의 목록이 로딩 중이라 종류를 모를 때도 조회를 미룬다. 수동 테스트에서 발견해 수정했다.
- 사이드바 활성 강의 판정은 `/course/{id}/`까지 비교한다. 단순 `includes`는 `/course/1`이 `/course/10`에도 걸린다(수동 테스트에서 발견해 수정).
- 공유 게시판 강의 필터에서는 직접 생성 강의를 제외한다.
- 생성·수정·삭제 성공 후 `CourseContext`의 강의 목록을 재조회하거나 기존 상태를 안전하게 갱신한다.
- 노트 생성·자동 저장·하위 노트 이동·AI 퀴즈 진입은 기존 `CourseDetailPage`, `useCourseNotes`, `NotionEditor`를 그대로 재사용한다.

#### 라우팅

- 기존 `/course/:courseId`와 `/course/:courseId/note/:noteId`를 그대로 사용한다.
- 프론트에서 유형을 보고 라우트를 나누지 않는다. 서버가 요청자 권한을 검사하므로 URL 직접 접근도 동일하게 처리된다.

### 4. 권한 처리

#### 권한 표

| 대상 | 수강 강의 수강생 | 직접 생성 강의 소유자 | 기타 사용자 |
|---|---:|---:|---:|
| 수강 강의 목록 표시 | 허용 | 해당 없음 | 차단 |
| 직접 생성 강의 목록 표시 | 본인 소유만 | 허용 | 차단 |
| 직접 생성 강의 노트 조회/생성 | 해당 없음 | 허용 | 403 |
| 직접 생성 강의 노트 수정/삭제 | 해당 없음 | 허용(소유자만 노트를 만들 수 있음) | 403 |
| 직접 생성 강의 노트·퀴즈 공유, 게시판 | 해당 없음 | 400/403(이번 범위 제외) | 403 |
| 직접 생성 강의 수정/삭제 | 차단 | 허용 | 403 |
| 시스템 수강 강의 수정/삭제 | 차단 | 해당 없음 | 차단 |

#### 서버 검증 원칙

- 프론트의 `userCreated`는 표시용일 뿐 권한 판단에 사용하지 않는다.
- 모든 강의 생성·수정·삭제와 노트 트리/생성/삭제 접근은 서버에서 현재 인증 학생을 기준으로 확인한다.
- `Course.owner`와 `Student.studId`를 비교하고, 직접 생성 강의가 아니면 소유자 권한을 적용하지 않는다.
- `NoteService`가 courseId만 확인하지 않고 note의 실제 `course`, `student`, parent note의 course/student를 함께 검증하도록 기존 흐름을 유지한다.
- 직접 생성 강의 ID를 임의로 바꾼 요청, 다른 학생의 courseId·noteId·parentNoteId 요청은 403 또는 404 정책에 맞게 차단한다.

### 5. 기존 기능 영향도

#### 영향이 없는 영역

- 기존 `Note` 테이블의 본문·트리·소유자 필드는 변경하지 않는다.
- 기존 수강 강의의 Enrollment 기반 접근과 강의 게시판은 그대로 동작한다.
- 기존 `/api/courses/{courseId}/notes/tree`, `/api/notes/{noteId}`, 노트 저장 API 경로는 유지한다.
- AI 퀴즈와 오답노트는 `courseId`를 기준으로 동작하므로 직접 생성 강의에서도 같은 강의·노트 권한을 통과하면 재사용 가능하다.
- 기존 CBT 공유와 노트 공유 기능은 공유 게시글의 `course_id`를 유지해 별도 정책으로 확장한다.

#### 반드시 확인할 영향

- `DashboardService`의 최근 노트는 `findTop6ByStudentOrderByUpdatedAtDesc`이므로 직접 생성 강의 노트도 자동으로 포함될 수 있다. UI에서 강의 표시만 보완하면 된다.
- `DashboardService`의 최근 게시글은 수강 강의만 조회하므로 직접 생성 강의 게시판을 제공하지 않는다면 현재 동작을 유지한다.
- `PostService`는 Enrollment만 요구하므로 직접 생성 강의에서는 커뮤니티 게시판을 제공하지 않는다(버튼 숨김).
- 수강 검증 위치별 처리는 "수강 검증 위치" 절을 따른다. `QuizService`·`IncorrectNoteService`는 변경하지 않는다.
- 강의 삭제 시 FK는 "관계와 삭제" 절의 순서(퀴즈 → 루트 노트 → 강의)로 해결한다.

### 6. 테스트 계획

#### Backend 단위/웹 계층

- 강의 생성
  - 인증 사용자가 강의명만으로 직접 생성 강의를 생성
  - `owner`, `userCreated=true`, 교수 null, 강의코드 null 검증
  - 빈 이름·길이 초과 400, 같은 이름 중복 생성 허용
- 강의 수정/삭제
  - 소유자 수정·삭제 성공
  - 다른 사용자 403
  - 시스템 수강 강의 수정·삭제 차단
  - 삭제 시 노트·하위 노트 정리 검증
  - 퀴즈·풀이 기록·오답노트 항목이 있어도 FK 오류 없이 삭제
- 목록
  - 기존 수강 강의와 본인 직접 생성 강의가 함께 반환
  - 다른 사용자의 직접 생성 강의는 반환되지 않음
  - `userCreated` 응답 필드 검증
  - 교수가 null인 직접 생성 강의가 섞여도 대시보드 정상 응답(NPE 회귀)
- NoteService 회귀
  - 수강 강의 수강생의 기존 노트 CRUD 유지
  - 직접 생성 강의 소유자의 노트 트리 조회·루트/하위 노트 생성·저장·삭제 성공
  - 다른 사용자의 직접 생성 강의 접근 403
  - 다른 강의의 parentNote 연결 차단
- 관련 서비스 권한
  - 직접 생성 강의 노트로 AI 퀴즈 생성·풀이·오답노트 추가 가능
  - 직접 생성 강의의 노트·퀴즈 공유 400
- 기존 회귀
  - 기존 DashboardService, NoteService, PostService 테스트 모두 통과

#### Frontend

- 사이드바 "강의목록"에서 수강 중인 강의/내가 만든 강의 그룹이 구분되어 표시되고, 대시보드에는 직접 생성 강의가 없음
- `+` 인라인 입력: Enter·포커스 이탈로 생성(한 번만), Esc·빈 이름은 취소
- 직접 생성 강의 생성·수정·삭제 UI
- 수강 강의에는 소유자 전용 버튼이 표시되지 않음
- 직접 생성 강의에는 커뮤니티·노트 공유 버튼이 표시되지 않음
- 공유 게시판 강의 필터에 직접 생성 강의가 나오지 않음
- 직접 생성 강의에서 기존 노트 트리·에디터·하위 노트 생성 동작
- 삭제 후 강의 목록과 현재 라우트 상태 갱신
- 다른 사용자의 강의 URL 직접 접근 시 403 오류 처리
- `CourseContext` 데이터 갱신과 사이드바/대시보드 동기화

#### 검증 명령

- Backend: `backend\gradlew.bat test`
- Frontend: `npm run lint`, `npm run build`, `npm run test`
- 운영 DDL을 추가한 경우 `SPRING_PROFILES_ACTIVE=prod`와 `ddl-auto: validate` 기동 검증
- 실제 DB에서 기존 수강 강의와 직접 생성 강의를 각각 생성해 노트·하위 노트·삭제 시나리오 확인

## 결정 사항(확정)

1. 이름 중복: 허용.
2. 게시판: 직접 생성 강의에는 제공하지 않음.
3. 삭제와 학습 데이터: 소유자의 해당 강의 퀴즈·풀이 기록·오답노트 항목까지 함께 삭제.
4. 노트 공유 범위: 이번 범위에서는 공유 불가(서버 400, 버튼 숨김). 공개 범위는 추후 별도 기능에서 결정.
5. soft delete: 하지 않음.

## 구현 순서

1. `Course` 소유권 필드와 `docs/database.md` 운영 DDL 추가
2. `CourseService`, repository 조회, 생성·수정·삭제 API 구현
3. `DashboardService`(NPE 수정 포함)/`CourseContext`에 수강 강의·내 강의 구분 반영
4. `NoteService`의 소유자 강의 접근 허용, 공유 서비스의 직접 생성 강의 400 처리
5. Backend 단위·웹·회귀 테스트 작성
6. Dashboard/Sidebar 강의 관리 UI, 커뮤니티·노트 공유 버튼 숨김, 공유 게시판 필터 제외
7. Frontend 테스트·lint/build 및 실제 다중 사용자 시나리오 검증
