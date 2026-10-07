# UniNote 노트 공유 게시판 구현 계획

## 문제와 목표

기존 UniNote는 `NoteService`가 노트 작성자 본인만 노트에 접근하도록 검증하고, `PostService`가 강의별 익명 게시글·댓글을 처리한다. 새로운 기능은 노트 페이지를 게시글 형태로 공유하고, 공유 시점의 루트 노트와 모든 하위 노트를 다른 수강생이 VIEW 권한으로 열람하게 하며, 공유 게시글에 댓글을 제공하는 것이다.

확정된 정책:

- 게시판 위치: 기존 `CBT 시험 공유게시판` 메뉴 아래 별도 `노트 공유 게시판` 메뉴
- 공개 범위: 공유한 노트가 속한 강의의 수강생
- 권한: VIEW만 지원. EDIT 기능과 편집 API는 만들지 않는다.
- 하위 노트: 공유 시점의 전체 하위 노트를 재귀적으로 포함
- 동기화: 공유 시점 스냅샷. 원본 변경은 공유본에 반영하지 않는다.
- 공유 단위: 루트 노트 하나당 활성 공유 게시글 하나
- 공유 해제: 작성자가 게시글을 삭제하면 즉시 접근 차단
- 댓글 삭제: 댓글 작성자 본인만 삭제
- 공유 게시글 제목: 루트 노트 제목을 자동 사용(입력 UI 없음)
- 댓글 수정: 기존 CBT 공유 댓글과 동일하게 작성자 본인 수정 지원(`QuestionComments` 재사용)
- 첨부 파일: 추가 처리 불필요(아래 "기존 코드와의 충돌 방지" 참고)
- 목록: 기존 CBT 공유 게시판처럼 페이지네이션 없이 최신순 전체 목록
- 공유 해제: soft delete 없이 cascade 삭제

## 기준 구현(복제할 선례)

CBT 시험 공유게시판이 같은 구조를 이미 갖고 있으므로 이를 그대로 따른다.

- `domain/SharedQuiz.java`, `SharedQuizComment.java`: 원본 ID를 FK가 아닌 unique 값으로 보관, 작성자·강의 N:1, `comments` cascade·orphanRemoval
- `service/SharedQuizService.java`: `share`, `deletePost`, `getPost`, `validateEnrollment`, `getOwnedComment`, `toCommentResponse`
- 예외: `CourseAccessException`(403), `InvalidRequestException`(400, 중복 공유), `ResourceNotFoundException`(404)
- 운영 DDL은 `docs/database.md`에 기록한다(migration 디렉터리 없음).

## 현재 코드 분석

### Note와 기존 권한

- `Note`는 `Course`, `Student`, `parentNote`, `childNotes`, Tiptap `content`, 미리보기·검색 필드를 가진다.
- `NoteService.getNote`, `saveNote`, `deleteNote`는 `validateOwnership`으로 작성자 본인 여부를 검사한다.
- `getNoteTree`는 같은 강의·학생의 모든 노트를 한 번에 조회한 뒤 `parentNoteId`로 메모리 트리를 구성한다.
- 기존 `/api/notes/{noteId}`를 공유 열람에 재사용하면 작성자 전용 403 정책을 깨뜨리므로 공유 조회 API를 별도로 둔다.
- 공유 스냅샷은 기존 `Note`의 학생/강의/부모 관계를 직접 재사용하지 않고 별도 엔티티로 저장해야 원본 삭제·수정과 권한 충돌을 피할 수 있다.

### Post/Comment와 게시판

- `Post`는 `Course`와 작성 학생을 연결하고 제목·본문·익명 여부·`Comment` 목록을 보유한다.
- `PostService`는 강의 수강 여부를 확인한 뒤 게시글·댓글 CRUD를 수행한다.
- 댓글 수정/삭제와 게시글 수정/삭제는 작성자 학번을 비교해 403을 반환한다.
- 기존 `Post.content` 하나에 여러 노트의 계층 구조를 직렬화해 넣는 방식은 노트별 열람·제목·트리 표현·공유 해제 처리가 불명확하므로 사용하지 않는다.
- 댓글 UX와 `CommentRequest`/`CommentResponse`, 익명명 생성 규칙은 재사용할 수 있지만, 노트 공유 게시글과 기존 게시판 댓글을 같은 `Post`/`Comment` 레코드로 섞지 않는다.

### User와 강의 권한

- 사용자 엔티티는 `Student`, 강의 수강 관계는 `Enrollment`다.
- 기존 기능은 `enrollmentRepository.existsByStudentAndCourse_CourseId`로 강의 접근을 검증한다.
- 노트 공유 목록·상세·댓글 조회·댓글 작성은 모두 공유 루트 노트의 `Course`에 대한 수강 여부를 서버에서 검사한다.
- 게시글 삭제와 댓글 삭제는 각각 공유 게시글 작성자, 댓글 작성자 본인만 허용한다.

### Frontend 구조

- `AppLayout`에 `CBT 시험 공유게시판` 메뉴가 직접 정의되어 있고, `SharedQuizBoardPage`가 공유 시험 목록·상세 풀이를 담당한다.
- `App.jsx`의 보호 라우트에 `/shared-quizzes`가 등록되어 있다.
- `useCourseBoard`/`CourseBoardPanel`은 강의 상세 화면의 기존 게시판과 댓글 상태를 담당한다.
- 노트 공유는 기존 강의 상세 게시판에 섞기보다 `SharedNoteBoardPage`와 `useSharedNotes`를 추가하고, `AppLayout`에서 CBT 공유 메뉴 아래에 진입점을 추가하는 방향이 기존 화면 책임과 충돌이 적다.
- 공유 노트 상세는 `NotionEditor`를 재사용하지 않고 읽기 전용 렌더러를 둔다. EDIT가 없으므로 자동 저장·업로드·slash command·노트 생성 로직을 공유 화면에 노출하지 않는다.

## 구현 계획

### 1. 기능/사용자 흐름

1. 사용자가 본인 노트의 메뉴에서 `노트 공유`를 선택한다.
2. 서버가 루트 노트의 소유권과 강의 수강 여부를 확인한다.
3. 서버가 루트 노트와 현재 존재하는 모든 하위 노트를 순회해 공유 스냅샷을 만든다.
4. 사용자는 `노트 공유 게시판`에서 자신이 수강 중인 강의의 공유 글 목록을 확인한다.
5. 목록에서 게시글을 열면 공유 시점의 노트 트리와 각 노트의 본문을 읽기 전용으로 확인한다.
6. 게시글 작성자는 본인 공유 글을 삭제할 수 있다. 삭제 후 해당 공유 글과 스냅샷은 더 이상 조회되지 않는다.
7. 공유 글 열람자는 댓글을 작성하고, 댓글 작성자는 자신의 댓글만 삭제할 수 있다.
8. 원본 노트의 수정·삭제·하위 노트 추가는 기존 노트 기능으로 처리되며, 이미 생성된 공유 스냅샷에는 영향을 주지 않는다.

### 2. DB(Entity/관계) 설계

#### 권장 엔티티

- `SharedNotePost` / `shared_note_posts`
  - `sharedNotePostId` PK
  - `sourceRootNoteId` 값 또는 원본 식별용 필드
  - `course` N:1
  - `student` N:1, 공유 게시글 작성자
  - `title`, `createdAt`
  - 활성 공유만 허용할 수 있도록 `sourceRootNoteId` unique 정책을 둔다.
- `SharedNoteSnapshot` / `shared_note_snapshots`
  - `snapshotId` PK
  - `sharedNotePost` N:1
  - `originalNoteId` 값, `parentOriginalNoteId` 값(루트는 null)
  - `title`, `content`
  - 공유 시점의 노트 계층과 내용을 독립적으로 보존한다.
  - 부모 관계를 자기참조 FK 대신 원본 ID 값으로 둔다. 자기참조 FK는 cascade 삭제 시 삭제 순서에 따라 FK 위반이 날 수 있고, 트리는 어차피 메모리에서 조립한다. `previewText`/`searchContent`는 뷰어가 쓰지 않으므로 복사하지 않는다.
- `SharedNoteComment` / `shared_note_comments`
  - `commentId` PK
  - `sharedNotePost` N:1
  - `student` N:1
  - `content`, `createdAt`
  - 게시글 삭제 시 댓글 cascade/orphan removal

`SharedNoteSnapshot`을 별도 테이블로 두는 이유는 원본 `Note`의 `student` 소유권과 `parentNote` 관계를 공유 사용자에게 노출하지 않고, 원본 삭제 후에도 DB FK 오류 없이 공유 게시글의 생명주기를 제어하기 위해서다. 게시글 삭제 시 공유 게시글·스냅샷·댓글은 함께 삭제하는 방식을 기본안으로 둔다. 공유 해제 후 접근 차단이라는 요구와 고아 스냅샷 누적을 동시에 막을 수 있다.

#### 운영 DDL/인덱스

- `course_id`, `stud_id`, `created_at` 인덱스
- `source_root_note_id` unique 인덱스
- 스냅샷·댓글은 `shared_note_post_id` FK 인덱스로 충분하다.
- 운영 프로파일이 `ddl-auto: validate`이므로 `docs/database.md`에 DDL을 추가한다.

### 3. Backend API/Service/권한 검증

#### API 초안

- `GET /api/shared-notes`
  - 현재 사용자가 수강 중인 강의의 공유 게시글 목록
  - 기본 최신순, 필요하면 `courseId` 필터와 페이지네이션을 기존 공유 CBT 목록과 동일한 방식으로 확장
- `POST /api/shared-notes`
  - 요청: `{ rootNoteId }`
  - 본인 루트 노트인지, 해당 강의를 수강 중인지, 이미 활성 공유가 있는지 검증
- `GET /api/shared-notes/{sharedNotePostId}`
  - 게시글 메타데이터와 스냅샷 노트 트리·본문 반환
  - 수강 여부 검증 후에만 조회
- `DELETE /api/shared-notes/{sharedNotePostId}`
  - 게시글 작성자 본인만 삭제
  - 공유 게시글·스냅샷·댓글 cascade 삭제
  - 응답의 노트 트리 노드는 `{ noteId(원본 ID), title, content, children }`. 원본 ID는 본문 안 `PageLink`의 `noteId`와 맞추기 위해서만 쓴다.
- `GET /api/shared-notes/{sharedNotePostId}/comments`
  - 해당 강의 수강생만 조회
- `POST /api/shared-notes/{sharedNotePostId}/comments`
  - 해당 강의 수강생만 작성
  - `CommentRequest`와 최대 길이 검증 재사용
- `PUT /api/shared-notes/comments/{commentId}`
  - 댓글 작성자 본인만 수정
- `DELETE /api/shared-notes/comments/{commentId}`
  - 댓글 작성자 본인만 삭제

#### 서비스

- `SharedNoteService` 하나에 공유 생성, 스냅샷 복사, 목록·상세 조회, 게시글 삭제, 댓글 CRUD, 수강·작성자 검증을 둔다(`SharedQuizService`와 같은 구성).
- 엔티티 → DTO 변환은 서비스 내부 private static 메서드로 둔다.

#### 권한 규칙

- 원본 노트 접근: 기존 `NoteService.validateOwnership`을 변경하지 않는다.
- 공유 생성: `rootNote.student == currentStudent` 및 `rootNote.course` 수강 여부 확인.
- 하위 노트는 같은 강의·학생 노트만 조회해 수집하므로 다른 강의/학생 노트가 섞일 수 없다(별도 검증 불필요).
- 공유 목록/상세/댓글 조회·작성: 현재 사용자의 `Enrollment`와 공유 게시글의 `course`를 비교.
- 게시글 삭제: `SharedNotePost.student`와 현재 사용자 비교.
- 댓글 삭제: `SharedNoteComment.student`와 현재 사용자 비교. 게시글 작성자에게 삭제 권한을 부여하지 않는다.
- 존재하지 않는 공유 ID와 권한 없는 공유 ID의 응답 정책은 기존 서비스 관례에 맞춰 404/403을 구분한다.

#### 기존 코드와의 충돌 방지

- `NoteController`의 `/api/notes/{noteId}`는 수정하지 않는다.
- `Post`/`Comment`에 노트 공유 전용 필드를 추가하지 않는다.
- 공유 스냅샷 응답에는 원본 `student`, 원본 소유권 정보, 편집 URL을 포함하지 않는다.
- 첨부 파일(확인 완료, 추가 작업 없음): `FileAccessSigner`는 `(파일명, 업로더 학번)`에 서명하고 요청자를 검증하지 않으며, `/api/upload/view/**`·`/download/**`는 `permitAll`이다. 본문에 저장된 서명 URL이 스냅샷에 그대로 복사되므로 다른 수강생도 열람된다. 파일 삭제 로직이 없어 원본 노트를 지워도 파일은 남는다.

### 4. Frontend 게시판 UI

- `SharedNoteBoardPage` 추가
  - 공유 노트 목록
  - 강의 필터
  - 제목·작성자·강의·공유일 표시
- 공유 생성 진입점: `CourseDetailPage` 헤더의 `AI 문제 생성` 옆 `노트 공유` 버튼(현재 노트와 하위 노트 공유). 공유는 서버에 저장된 내용을 복사하므로 저장 상태가 `synced`일 때만 활성화한다.
- `SharedNoteViewer` 추가
  - 노트 트리와 현재 선택 노트 본문 표시
  - `useEditor({ editable: false })`로 렌더링한다. 본문에는 `PageLink`, `PdfBlock`, `BlockId`, 이미지, 코드 블록 노드가 있으므로 `NotionEditor.jsx`의 스키마 확장(SlashCommand·Placeholder 제외)과 에디터 스타일을 export해 그대로 쓴다. `NotionEditor` 자체는 재사용하지 않는다(자동 저장·localStorage 복구가 원본 noteId로 동작하므로).
  - `PageLink`는 `useNoteTree().findTitle(noteId)`로 제목을 찾으므로 뷰어를 스냅샷 트리로 만든 `NoteTreeProvider`로 감싼다. 링크 클릭 시 스냅샷 안의 노트면 그 노트로 전환하고, 공유 범위 밖이면 저장된 제목만 표시한다.
  - 편집 버튼·자동 저장·파일 업로드·노트 생성 기능을 표시하지 않음
- `useSharedNotes`
  - 목록 조회, 상세 조회, 공유 삭제
  - 기존 `client.js` Axios 인터셉터 사용
- 댓글 UI: `components/quiz/QuestionComments.jsx`의 하드코딩된 URL을 props(`addUrl`, `commentUrl`)로 받게 바꿔 CBT와 노트 공유가 함께 쓴다.
- `AppLayout`
  - CBT 시험 공유게시판 메뉴 아래에 `노트 공유 게시판` 메뉴 추가
- `App.jsx`
  - 보호 라우트 `/shared-notes` 및 상세 경로 추가
- 기존 `SharedQuizBoardPage`와 컴포넌트 스타일·course filter·empty state 패턴을 재사용하되, 퀴즈 풀이 컴포넌트는 재사용하지 않는다.

### 5. 댓글 기능

- 기존 `CommentRequest`의 content validation을 재사용한다.
- 응답은 `CommentResponse`의 `commentId`, 익명 작성자명, `isAuthor`, `content`, `createdAt` 패턴을 유지한다.
- 댓글 목록은 공유 게시글 상세에서 로드한다.
- 작성자는 자신의 댓글에만 삭제 버튼을 본다. 버튼 노출은 UI 편의일 뿐이고 서버가 최종 검증한다.
- 삭제 실패 시 서버 `message`를 alert 또는 기존 공통 오류 처리 방식으로 표시한다.
- 댓글 작성·조회는 공유 노트 게시글의 강의 수강생만 가능하게 한다.

### 6. 하위 노트 공유 처리

1. 루트 노트를 조회하고 작성자·강의·수강 여부를 검증한다.
2. 기존 `NoteRepository.findByCourseAndStudentOrderByCreatedAtAsc`로 같은 강의·학생 노트를 한 번에 조회하고, `getNoteTree`처럼 `parentNoteId`로 묶어 N+1을 피한다(새 repository 메서드 불필요).
3. 원본 노트 ID를 방문 집합으로 관리해 순환 데이터가 있어도 무한 루프가 없게 한다.
4. 루트부터 모든 하위 노트를 BFS로 순회한다.
5. 각 노트의 title/content를 스냅샷으로 복사한다.
6. 원본 `parentNote` 관계는 `parentOriginalNoteId` 값으로 보관한다.
7. 공유 생성 시점 이후 원본에 추가된 하위 노트는 포함하지 않는다.
8. 공유 게시글 삭제 시 스냅샷 전체를 cascade 삭제한다.
9. 상세 응답은 스냅샷 트리와 본문만 반환하고 원본 노트 API 링크는 반환하지 않는다.

대안으로 원본 `Note`를 직접 참조하고 조회 시점에 권한을 검사하는 방법은 구현량이 적지만, 공유 후 원본 변경·삭제의 영향을 받고 기존 `NoteService` 소유권 검사와 충돌할 가능성이 크므로 채택하지 않는다.

### 7. 테스트 계획

#### Backend 단위/웹 계층

- 공유 생성
  - 본인 루트 노트 성공
  - 타인 노트 403
  - 미수강 강의 403
  - 하위 노트 전체 스냅샷 생성
  - 동일 루트 노트 중복 공유 400
- 공유 조회
  - 같은 강의 수강생 성공
  - 다른 강의 또는 미수강 학생 403
  - 스냅샷 제목·본문·트리 순서 검증
  - 원본 수정·삭제 후 공유 스냅샷 유지
  - 게시글 삭제 후 목록·상세·댓글 조회 404
- 게시글 삭제
  - 작성자 성공
  - 다른 사용자 403
  - 스냅샷·댓글 cascade 삭제 검증
- 댓글
  - 수강생 작성·조회 성공
  - 미수강 학생 403
  - 본인 삭제 성공
  - 타인 댓글 삭제 403
  - 존재하지 않는 댓글 404
  - content 길이·공백 검증
- 회귀
  - 기존 `NoteService`의 타인 노트 접근 403 유지
  - 기존 `PostService` 게시판·댓글 CRUD 영향 없음
  - 기존 `SharedQuizService` API와 경로 충돌 없음

#### Frontend

- 공유 게시판 목록·강의 필터·빈 상태
- 공유 생성 버튼과 성공 후 중복 상태
- 읽기 전용 노트 트리 탐색
- EDIT UI와 자동 저장 API가 호출되지 않음
- 댓글 작성·삭제 버튼의 작성자 조건
- 게시글 삭제 후 목록에서 제거
- 401/403/404 오류 표시
- 라우트와 사이드바 메뉴 활성화

#### 검증 명령

- Backend: `backend\gradlew.bat test`
- Frontend: `npm run lint`, `npm run build`, `npm run test`
- 운영 DDL이 추가되면 prod `ddl-auto: validate` 기동 검증을 별도로 수행한다.

## 결정 사항(확정)

1. 첨부 파일: 서명 URL이 요청자와 무관하므로 추가 작업 없음.
2. 제목: 루트 노트 제목 자동 사용.
3. 페이지네이션: 없음(CBT 공유 게시판과 동일).
4. 공유 해제: cascade hard delete.
5. 댓글 수정: 지원.

## 구현 순서

1. 공유 노트·스냅샷·댓글 엔티티와 repository 추가
2. `SharedNoteService` 및 권한 검증 구현
3. Controller/DTO/API 문서(`docs/api.md`)/운영 DDL(`docs/database.md`) 갱신
4. Backend 단위 테스트 구현
5. 읽기 전용 공유 노트 viewer와 게시판 UI 구현
6. Frontend 테스트·lint/build 및 수동 다중 사용자 시나리오 검증
