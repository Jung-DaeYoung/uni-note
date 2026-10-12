# 🎓 UniNote 코드 과외 — 7강: 강의 커뮤니티 익명 게시판 & 댓글 시스템

---

## 1. 이 기능이 무엇인가?

같은 강의를 수강하는 학생들끼리 모르는 과제나 시험 문제를 질문하고 토론할 수 있는 **강의별 익명 커뮤니티 게시판과 댓글 시스템**입니다.  
학생의 실명이나 학번을 완전히 숨겨 자유로운 질문을 유도하면서도, **수강생만 들어올 수 있는 접근 제어**와 **본인이 쓴 글/댓글만 수정·삭제할 수 있는 안전한 권한 통제**가 결합되어 있습니다.

---

## 2. 왜 필요한가?

1. **질문의 심리적 장벽 해소**: 실명 게시판에서는 "이런 기초적인 것도 모르냐"는 시선이 두려워 질문을 꺼립니다. **철저한 익명성**이 보장되어야 활발한 질의응답이 일어납니다.
2. **강의별 보안 격리**: 타 학과 학생이나 미수강생이 들어와 족보를 훔쳐보거나 분란을 일으키지 못하도록, **해당 강의를 수강 중인 학생(`enrolledCourses`)만 접근**할 수 있어야 합니다.
3. **대화 맥락 유지**: 완전 무작위 익명(글마다 바뀌는 익명)은 "익명1이 방금 말한 사람인지 다른 사람인지" 대화 흐름을 파악하기 어렵습니다. 따라서 **한 글 안에서 작성자를 구분할 수 있는 일관된 가명 체계**가 필요합니다.

---

## 3. 전체 동작 흐름

```
1. 학생이 강의실 우측 상단 "커뮤니티" 버튼 클릭
  ↓
2. useCourseBoard 훅 실행: GET /api/posts/{courseId} 호출
  ↓
3. PostController → PostService.getPosts() 수신:
   - 1차 보안: 학생이 이 강의를 수강 중인가? (validateEnrollment)
   - 미수강생이면 즉시 403 Forbidden 차단!
  ↓
4. DB에서 해당 강의 글 목록 및 댓글 일괄 조회:
   - SELECT * FROM posts WHERE course_id = ? ORDER BY created_at DESC
  ↓
5. PostService의 DTO 변환 및 가명(Pseudonym) 부여:
   - 실제 학번/ID는 은닉하고 "익명 " + (studId % 100) 형태로 가명 생성
   - 현재 조회 중인 사용자가 작성자인지 비교하여 isAuthor = true/false 계산
  ↓
6. CourseBoardPanel.jsx 우측 슬라이드 패널(Drawer) 렌더링:
   - 글 목록 표시, 클릭 시 상세 글 및 댓글 뷰(detail)로 전환
   - isAuthor === true인 경우에만 우측 상단에 "수정(연필)", "삭제(휴지통)" 아이콘 노출
  ↓
7. 글/댓글 작성 시:
   - POST /api/posts/{courseId} 또는 POST /api/posts/{postId}/comments 호출
   - DB에 저장 후 최신 게시판 목록 자동 리프레시
```

---

## 4. 실제 코드 위치

**Backend:**
- `backend/.../controller/PostController.java` — 게시글 및 댓글 CRUD 엔드포인트
- `backend/.../service/PostService.java` — 수강생 인가 검증(`validateEnrollment`), 익명 가명 산출, 작성자 본인 검증, DTO 변환
- `backend/.../domain/Post.java` — `posts` 테이블 엔티티 (댓글과 1:N 관계, `CascadeType.ALL`)
- `backend/.../domain/Comment.java` — `comments` 테이블 엔티티 (게시글 및 학생과 N:1 매핑)
- `backend/.../dto/PostResponse.java`, `CommentResponse.java` — 학생의 개인정보를 제외하고 가명과 `isAuthor`만 담는 DTO

**Frontend:**
- `frontend/src/components/course/CourseBoardPanel.jsx` — 우측 슬라이딩 패널 UI (목록, 상세, 글작성, 글수정, 댓글작성, 전체화면 토글)
- `frontend/src/hooks/useCourseBoard.js` — 게시판 API 통신, 낙관적/비동기 상태 동기화, 대시보드 `postId` 딥링크 처리
- `frontend/src/pages/CourseDetailPage.jsx` — 강의실 화면과 게시판 패널을 연결하는 부모 레이아웃

**Database:**
- `posts`: `post_id`, `course_id`, `stud_id`, `title`, `content`, `anonymous`, `created_at`
- `comments`: `comment_id`, `post_id`, `stud_id`, `content`, `anonymous`, `created_at`
- `enrollments`: 학생의 강의 수강 권한 검증용 매핑 테이블

---

## 5. 코드가 실제로 어떻게 실행되는가?

### 🔵 STEP 1. 수강생 검증 (`validateEnrollment`) — 1차 방어선

미수강생이 API 주소를 직접 찔러보더라도 서비스 계층에서 단호하게 차단합니다.

`PostService.java`:

```java
public List<PostResponse> getPosts(Long courseId, String studentNum) {
    Course course = courseRepository.findById(courseId)
            .orElseThrow(() -> new ResourceNotFoundException("Invalid course ID"));
    Student student = studentRepository.getByStudentNum(studentNum);

    // 🔒 수강 여부 검증: 이 강의를 수강 신청한 학생인가?
    validateEnrollment(student, courseId);

    return postRepository.findByCourseOrderByCreatedAtDesc(course).stream()
            .map(post -> convertToResponse(post, studentNum))
            .collect(Collectors.toList());
}

private void validateEnrollment(Student student, Long courseId) {
    if (!enrollmentRepository.existsByStudentAndCourse_CourseId(student, courseId)) {
        throw new CourseAccessException("해당 강의를 수강하지 않습니다."); // 403 예외 발생
    }
}
```

> 💬 **쉽게 말하면**: "이 강의실 문을 열기 전에 수강증부터 보여주세요. 수강생 명단에 없으면 게시판 글을 1글자도 볼 수 없습니다."

---

### 🔵 STEP 2. 실명 보호 가명(Pseudonym) 알고리즘과 `isAuthor` 플래그

게시판 API의 가장 큰 보안 딜레마는 **"학생의 개인정보를 숨기면서도, 본인에게만 수정/삭제 권한을 어떻게 줄 것인가?"**입니다.

`PostService.java`:

```java
private PostResponse convertToResponse(Post post, String studentNum) {
    String authorName = "익명";
    boolean isPostAuthor = false;
    
    if (post.getStudent() != null && studentNum != null) {
        // 1. 현재 접속한 사람이 글 작성자 본인인가? (true/false 계산)
        isPostAuthor = post.getStudent().getStudentNum().trim().equals(studentNum.trim());
        
        // 2. 실제 DB PK(studId)의 100 나머지 연산으로 가명 부여
        authorName = "익명 " + (post.getStudent().getStudId() % 100);
    }

    // 댓글 목록도 동일하게 변환
    List<CommentResponse> comments = post.getComments().stream()
            .map(c -> {
                boolean isCommentAuthor = c.getStudent() != null && studentNum != null && 
                        c.getStudent().getStudentNum().trim().equals(studentNum.trim());
                String commentAuthorName = (c.getStudent() != null) ? 
                        "익명 " + (c.getStudent().getStudId() % 100) : "익명";
                
                return CommentResponse.builder()
                    .commentId(c.getCommentId())
                    .content(c.getContent())
                    .authorName(commentAuthorName)
                    .isAuthor(isCommentAuthor) // 본인 댓글인지 여부만 플래그로 전송!
                    .createdAt(c.getCreatedAt())
                    .build();
            })
            .collect(Collectors.toList());

    return PostResponse.builder()
            ...
            .authorName(authorName) // "익명 24"
            .isAuthor(isPostAuthor) // true / false
            .comments(comments)
            .build();
}
```

> **왜 프론트엔드로 학번을 안 보내고 `isAuthor` boolean만 보낼까요?**  
> 만약 응답 JSON에 `studentNum: "20211234"`를 그대로 실어 보내면, 브라우저 개발자 도구(F12)의 Network 탭에서 **누가 쓴 글인지 실명과 학번이 다 까발려집니다!**  
> 따라서 서버가 비교를 끝내고 오직 `isAuthor: true/false`라는 boolean 깃발만 건네주는 것이 익명 게시판 보안의 핵심입니다.

> 💬 **쉽게 말하면**: 프론트엔드에게는 "너 학번 20211234 맞지?"라고 알려주지 않고, "이 글 너가 쓴 거 맞으니까(isAuthor: true) 수정 버튼 띄워!"라고 결과만 넌지시 알려줍니다.

---

### 🔵 STEP 3. UI에서 본인 확인 후 수정/삭제 버튼 렌더링

`CourseBoardPanel.jsx`:

```jsx
{/* 글 작성자 본인에게만 연필/휴지통 아이콘 표시 */}
{selectedPost.isAuthor && (
  <div className="flex items-center gap-1">
    <button 
      onClick={() => { setEditingPost({ title: selectedPost.title, content: selectedPost.content }); setBoardView('edit'); }}
      className="p-1 text-slate-400 hover:text-blue-600"
    >
      <PenLine size={12} />
    </button>
    <button 
      onClick={handleDeletePost}
      className="p-1 text-slate-400 hover:text-red-500"
    >
      <Trash2 size={12} />
    </button>
  </div>
)}
```

> 💬 **쉽게 말하면**: 내가 쓴 글이나 댓글에는 연필과 쓰레기통 아이콘이 보이지만, 남이 쓴 글에는 아이콘 자체가 아예 나타나지 않습니다.

---

### 🔵 STEP 4. 백엔드의 2차 본인 검증 (API 위조 공격 차단)

해커가 개발자 도구에서 `isAuthor` 값을 임의로 `true`로 바꾸거나 Postman으로 `DELETE /api/posts/5`를 직접 호출하면 어떻게 될까요?  
백엔드 서비스가 2차로 철벽 방어합니다.

`PostService.java`:

```java
@Transactional
public void deletePost(Long postId, String studentNum) {
    Post post = postRepository.findById(postId)
            .orElseThrow(() -> new ResourceNotFoundException("Invalid post ID"));

    // 🔒 서버 2차 검증: 요청을 보낸 학생이 실제 작성자가 아니면 즉시 거부!
    if (!post.getStudent().getStudentNum().equals(studentNum)) {
        throw new CourseAccessException("작성자 본인만 삭제할 수 있습니다.");
    }
    
    postRepository.delete(post);
}
```

> 💬 **쉽게 말하면**: 화면 버튼을 뚫고 들어오더라도, 서버 금고 문앞에서 "토큰의 주인(studentNum)과 DB에 적힌 작성자"를 대조하여 남의 글 삭제 시도를 철저히 차단합니다.

---

### 🔵 STEP 5. 부모 글 삭제 시 댓글 자동 연쇄 삭제 (`orphanRemoval`)

`Post.java`:

```java
@OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true)
private List<Comment> comments = new ArrayList<>();
```

> 💬 **쉽게 말하면**: 게시글이 삭제되면 그 밑에 달려 있던 수십 개의 댓글들도 DB에서 지저분하게 찌꺼기로 남지 않고 한꺼번에 자동 삭제됩니다.

---

### 🔵 STEP 6. 대시보드 알림에서 특정 글로 바로 워프하는 딥링크 (Deep Link)

2강(대시보드)에서 배운 '최근 게시글'을 클릭하면 `/course/1?postId=42`로 이동합니다.  
강의실 페이지에 들어왔을 때 게시판이 자동으로 열리며 해당 글이 펼쳐지는 비결입니다.

`useCourseBoard.js`:

```javascript
// URL의 ?postId=42 파라미터를 감지하여 자동으로 해당 글 열기
useEffect(() => {
  const params = new URLSearchParams(searchString);
  const postIdFromUrl = params.get('postId');

  if (postIdFromUrl && posts.length > 0) {
    const targetPost = posts.find(p => p.postId === parseInt(postIdFromUrl));
    if (targetPost) {
      setSelectedPost(targetPost); // 해당 글 선택
      setBoardView('detail');     // 상세 보기 화면으로 전환
      setIsBoardOpen(true);       // 우측 패널 자동 오픈!
    }
  }
}, [searchString, posts]);
```

> 💬 **쉽게 말하면**: 홈 화면에서 "알고리즘 과제 힌트" 글을 클릭하면, 강의실로 이동하자마자 우측 게시판 창이 스르륵 열리며 그 글의 댓글들이 바로 화면에 펼쳐집니다.

---

## 6. 데이터가 어떻게 이동하는가?

```
[학생: 새 댓글 입력 후 "전송"]
       ↓
[useCourseBoard: handleSendComment()]
   POST /api/posts/10/comments
   Body: { content: "그 문제 3페이지 공식 쓰면 풀려요!" } (헤더: Bearer JWT 토큰)
       ↓
[Spring Boot: PostController.addComment()]
       ↓
[PostService.addComment()]
   ├── validateEnrollment() → 수강생 확인
   └── Comment 엔티티 생성 및 DB INSERT:
       INSERT INTO comments (post_id, stud_id, content, created_at) VALUES (10, 5, '...', NOW());
       ↓ 200 OK
[프론트엔드: 자동 리프레시]
   GET /api/posts/1
       ↓
[PostService.convertToResponse()]
   - 작성자 학번 매칭:
     - 내 댓글: authorName="익명 5", isAuthor=true
     - 남의 댓글: authorName="익명 88", isAuthor=false
       ↓
[CourseBoardPanel UI 렌더링]
   - 내 댓글에만 수정/삭제 버튼 활성화
   - 화면에 새로운 댓글 즉시 반영!
```

---

## 7. 왜 이렇게 설계했는가?

1. **왜 완전 랜덤 익명이 아니라 `studId % 100` 가명을 쓰는가?**
   - 글마다 완전히 새로운 무작위 닉네임("푸른사자", "노란기린")을 부여하면 한 게시글 안에서 "댓글 1을 쓴 사람이 댓글 3도 쓴 사람인가?"를 알 수 없어 대화의 맥락이 끊깁니다.
   - 학번 고유 ID를 100으로 나눈 나머지(`% 100`)를 쓰면 0~99 사이의 가명("익명 24")이 고정되어 **한 강의실 안에서 일관된 화자 구분이 가능하면서도 실제 학번은 절대 역추적할 수 없습니다.**

2. **왜 독립된 게시판 페이지 대신 우측 슬라이드 패널(Drawer)인가?**
   - 학생의 주된 행동은 "노트 필기"입니다.
   - 질문 하나를 보려고 노트 페이지를 벗어나 게시판 페이지로 이동했다가 다시 돌아오는 것은 학습 흐름을 심각하게 방해합니다.
   - 노트를 작성하면서 우측에 커뮤니티 패널을 열어두고 실시간으로 질문을 검색할 수 있도록 **분할 작업(Multi-tasking) UX**로 설계했습니다.

3. **왜 `readOnly = true` 트랜잭션을 기본으로 두었는가?**
   - `PostService` 클래스 상단에 `@Transactional(readOnly = true)`를 선언하고 수정이 일어나는 메서드에만 `@Transactional`을 붙였습니다.
   - 게시판은 쓰기보다 조회가 90% 이상이므로 불필요한 더티 체킹(Dirty Checking) 스냅샷 생성을 줄여 서버 메모리와 응답 속도를 최적화했습니다.

---

## 8. 초보자가 헷갈리기 쉬운 부분

| 헷갈리는 것 | 실제 동작 |
|---|---|
| 익명 게시판인데 DB에도 이름이 안 들어가나요? | **아닙니다.** DB `posts` 및 `comments` 테이블에는 `stud_id` 외래키가 분명히 기록됩니다(악성 유저 제재 및 내부 감사용). 단지 **클라이언트로 나갈 때 DTO 변환 과정에서 가명으로 치환**되는 것입니다. |
| 프론트엔드에서 `isAuthor`를 위조하면 남의 글을 지울 수 있나요? | **불가능합니다.** 프론트엔드의 `isAuthor`는 버튼을 보여줄지 말지 결정하는 UI용일 뿐, 서버의 `deletePost()`에서 JWT 토큰의 실제 학번과 DB 작성자 학번을 다시 대조합니다. |
| 댓글은 왜 페이징 처리를 안 하나요? | 대학 강의 게시판 특성상 한 글에 달리는 댓글은 보통 수 개에서 수십 개 수준입니다. `Post` 엔티티의 `List<Comment>` 컬렉션으로 한 번에 가져오는 것이 사용자 경험상 훨씬 자연스럽습니다. |

---

## 9. 시험/면접에서 알아야 할 핵심

> **"익명 커뮤니티 기능을 구현할 때 작성자의 프라이버시 보호와 수정/삭제 권한 통제를 어떻게 조화시켰나요?"**

✅ 이렇게 설명할 수 있습니다:
> "가장 중요한 설계 원칙은 **'클라이언트 응답 데이터에 작성자의 식별 정보(학번/실명/DB PK)를 1비트도 노출하지 않는다'**였습니다.  
> UniNote에서는 첫째, DB의 학생 식별자를 해시/나머지 연산(`studId % 100`)으로 가공하여 일관되면서도 역추적 불가능한 가명('익명 24')을 생성했습니다.  
> 둘째, 작성자 본인 여부는 클라이언트가 판단하는 것이 아니라 서버가 JWT 토큰의 주체와 DB 작성자를 직접 비교한 뒤 오직 boolean 형태의 **`isAuthor` 플래그**만 내려주도록 DTO를 설계했습니다.  
> 셋째, 클라이언트 변조를 방지하기 위해 실제 수정/삭제 요청(`PUT`, `DELETE`)이 들어올 때도 Controller가 아닌 Service 계층에서 Spring Security의 인증 주체(`studentNum`)를 다시 한번 검증하여 무단 변조를 원천 차단했습니다."

---

## 10. 이해 확인 문제 📝

**Q1. (쉬운 문제)**  
UniNote 게시판에서 학생들에게 부여되는 가명(예: "익명 42")은 어떤 계산 공식으로 만들어지나요?

**Q2. (흐름 문제)**  
학생이 대시보드 홈에서 특정 최신 게시글 카드를 클릭했을 때, 강의실 페이지에서 해당 게시글이 자동으로 열리기까지의 딥링크(Deep Link) 흐름을 설명해 보세요.

**Q3. (코드 이해)**  
`PostService.java`의 `convertToResponse` 메서드에서 클라이언트에게 학생의 학번(`studentNum`)을 넘기지 않고 `isAuthor` 플래그만 넘겨주는 보안상의 이유는 무엇인가요?

**Q4. (설계 이해)**  
`Post.java`의 `comments` 매핑에 `orphanRemoval = true` 옵션이 설정되어 있는 이유는 무엇인가요?

**Q5. (면접형)**  
만약 악의적인 사용자가 프론트엔드 자바스크립트 코드를 조작해 다른 사람 글의 `isAuthor`를 `true`로 바꾼 뒤 "삭제" 버튼을 클릭했을 때, 왜 실제 삭제가 일어나지 않는지 백엔드 관점에서 설명해 보세요.
