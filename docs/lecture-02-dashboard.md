# 🎓 UniNote 코드 과외 — 2강: 대시보드 (Dashboard)

---

## 1. 이 기능이 무엇인가?

로그인한 학생이 접속했을 때, **내가 수강 중인 강의 목록, 최근에 작성/수정한 노트, 내가 듣는 강의들의 최신 커뮤니티 글**을 한눈에 모아 보여주는 홈 화면입니다.

---

## 2. 왜 필요한가?

UniNote는 여러 과목의 노트 필기, 퀴즈, 게시판이 얽혀 있는 플랫폼입니다.
만약 대시보드가 없다면 학생은 강의를 찾으러 일일이 메뉴를 뒤져야 하고, 방금 전까지 쓰던 노트나 새 게시글을 확인하기 번거롭습니다. **학생 개인화된 '학습 허브'** 역할을 하기 위해 필요합니다.

---

## 3. 전체 동작 흐름

```
1. 사용자가 로그인 후 /dashboard 페이지 진입 (또는 새로고침)
  ↓
2. AppLayout 및 DashboardPage 마운트
  ↓
3. CourseContext.jsx의 useEffect 실행 → fetchCourses() 호출
  ↓
4. client.js (Axios)가 GET /api/dashboard/courses 요청 전송
   (※ 1강에서 배운 Request Interceptor가 헤더에 "Authorization: Bearer <토큰>" 자동 부착)
  ↓
5. Spring Security JwtFilter가 토큰 확인 → 학번(studentNum)을 Authentication에 주입
  ↓
6. DashboardController.java의 getCourses() 수신
  ↓
7. DashboardService.java의 getDashboardData(studentNum) 실행
  ↓
8. Repository들을 통해 DB 조회:
   - EnrollmentRepository: 학생이 수강 중인 강의 목록 조회
   - NoteRepository: 학생의 최근 수정 노트 Top 6 조회
   - PostRepository: 수강 강의들에 올라온 최신 게시글 Top 5 조회
  ↓
9. DashboardResponse DTO로 조립 후 JSON 반환
  ↓
10. CourseContext 상태 업데이트 (courses, recentNotes, recentPosts, studentName)
  ↓
11. DashboardPage 및 AppLayout(사이드바) 화면에 렌더링
```

---

## 4. 실제 코드 위치

**Frontend:**
- `frontend/src/pages/DashboardPage.jsx` — 메인 대시보드 뷰 (강의 목록 카드, 최근 노트 그리드, 최근 게시글)
- `frontend/src/context/CourseContext.jsx` — `/dashboard/courses` API를 호출하고 응답 데이터를 전역 상태로 보관
- `frontend/src/components/layout/AppLayout.jsx` — 대시보드 화면을 감싸는 전체 레이아웃 (사이드바에 수강 강의 목록 표시 + 테마 토글 버튼)

**Backend:**
- `backend/.../controller/DashboardController.java` — `GET /api/dashboard/courses` 엔드포인트
- `backend/.../service/DashboardService.java` — 학생별 수강 강의, 최근 노트, 게시글 통합 조회 및 익명 처리
- `backend/.../dto/DashboardResponse.java` — 대시보드 응답 DTO

**Database & Entities:**
- `students` (학생)
- `courses` (강의)
- `enrollments` (수강 내역: Student와 Course의 다대다 매핑 엔티티)
- `notes` (노트: 수정일시 기준 정렬)
- `posts` (게시판 글)

---

## 5. 코드가 실제로 어떻게 실행되는가?

### 🔵 STEP 1. 페이지 로딩과 데이터 캐싱 (CourseContext)

`CourseContext.jsx`:

```jsx
export const CourseProvider = ({ children }) => {
  const [courses, setCourses] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);
  const [recentNotes, setRecentNotes] = useState([]);
  const [studentName, setStudentName] = useState('');
  const { isAuthenticated } = useAuth();

  const fetchCourses = useCallback(async (signal) => {
    if (!isAuthenticated) return;
    try {
      const response = await client.get('/dashboard/courses', { signal });
      setCourses(response.data.courses || []);
      setRecentPosts(response.data.recentPosts || []);
      setRecentNotes(response.data.recentNotes || []);
      setStudentName(response.data.studentName || '');
    } catch (error) {
      if (axios.isCancel(error)) return;
      console.error("강의 목록 로딩 실패", error);
    }
  }, [isAuthenticated]);
  ...
```

> 💬 **쉽게 말하면**: 사이드바(`AppLayout.jsx`)도 내 강의 목록이 필요하고, 메인 화면(`DashboardPage.jsx`)도 강의/노트 목록이 필요합니다. 각각 API를 따로 부르면 중복 요청이 생기므로, **`CourseContext`에서 딱 1번만 부르고 둘이서 나눠 쓰도록** 만들어져 있습니다.

---

### 🔵 STEP 2. Controller에서 로그인 사용자 꺼내기

`DashboardController.java`:

```java
@GetMapping("/courses")
public ResponseEntity<DashboardResponse> getCourses(Authentication authentication) {
    // 1강에서 JwtFilter가 저장해둔 학번을 가져옵니다.
    String studentNum = authentication.getName();
    DashboardResponse dashboardData = dashboardService.getDashboardData(studentNum);
    return ResponseEntity.ok(dashboardData);
}
```

> 💬 **쉽게 말하면**: 클라이언트가 URL에 학번을 보내지 않아도 됩니다. 1강에서 배운 팔찌(JWT) 검사를 통해 Spring이 이미 "이 요청은 학번 누구 거다"를 알고 있어서 `authentication.getName()`으로 바로 꺼냅니다.

---

### 🔵 STEP 3. Service에서 3가지 데이터 묶음 조회

`DashboardService.java`:

```java
@Transactional(readOnly = true)
public DashboardResponse getDashboardData(String studentNum) {
    Student student = studentRepository.getByStudentNum(studentNum);

    // 1. 내가 수강 중인 강의 목록
    List<Enrollment> enrollments = enrollmentRepository.findByStudent(student);
    List<CourseResponse> courseList = enrollments.stream()...

    // 2. 내가 최근에 수정한 노트 6개
    List<NoteSummaryResponse> recentNotes = noteRepository
            .findTop6ByStudentOrderByUpdatedAtDesc(student).stream()...

    // 3. 내가 수강 중인 강의의 최근 게시글 5개 (미수강 강의 글 유출 방지!)
    List<Course> enrolledCourses = enrollments.stream().map(Enrollment::getCourse).toList();
    List<PostResponse> recentPosts = (enrolledCourses.isEmpty()
            ? List.<Post>of()
            : postRepository.findTop5ByCourseInOrderByCreatedAtDesc(enrolledCourses)).stream()...

    return DashboardResponse.builder()
            .studentName(student.getName())
            .courses(courseList)
            .recentPosts(recentPosts)
            .recentNotes(recentNotes)
            .build();
}
```

> 💬 **쉽게 말하면**:
> 1. "내가 수강 신청한 강의가 뭐지?" (`enrollments`)
> 2. "내가 최근에 만진 노트 6개 가져와줘" (`recentNotes`)
> 3. "그 강의들 게시판에 새로 올라온 글 5개만 뽑아줘" (`recentPosts`)  
> 이 3가지를 한 번에 모아서 택배 상자(`DashboardResponse`) 하나에 포장해 내려줍니다.

---

### 🔵 STEP 4. 프론트엔드 렌더링 및 시간 계산

`DashboardPage.jsx`:

```jsx
const { courses, recentPosts, recentNotes, studentName } = useCourses();

// "방금 전", "5분 전", "2시간 전" 계산 함수
const formatTime = (dateStr) => { ... };

return (
  <AppLayout>
    <h2>반갑습니다, {studentName || '사용자'}님! 👋</h2>
    {/* 좌측 1/3: 수강 강의 목록 */}
    ...
    {/* 우측 2/3: 최근 노트 기록 (3x2 카드 그리드) + 최신 게시글 5개 */}
    ...
  </AppLayout>
);
```

> 💬 **쉽게 말하면**: Context에서 받아온 데이터를 반응형 그리드 UI로 예쁘게 배치하고, 노트 수정 시간을 "2시간 전" 같은 자연스러운 텍스트로 바꿔 보여줍니다.

---

## 6. 데이터가 어떻게 이동하는가?

```
[사용자]
   ↓ /dashboard 접속
[DashboardPage & AppLayout]
   ↓ 공유
[CourseContext]
   ↓ client.get('/dashboard/courses')
[DashboardController] (인증 주체: studentNum 확보)
   ↓ getDashboardData(studentNum)
[DashboardService]
   ├── EnrollmentRepository ───→ DB: enrollments + courses 조회
   ├── NoteRepository ──────────→ DB: notes WHERE student = ? ORDER BY updated_at DESC LIMIT 6
   └── PostRepository ──────────→ DB: posts WHERE course IN (?) ORDER BY created_at DESC LIMIT 5
   ↓ DTO 조립
[DashboardResponse] (JSON 직렬화)
   ↓
[CourseContext State]
   ↓
[화면 렌더링]: 강의 카드 클릭 시 → `/course/:id`, 노트 클릭 시 → `/course/:id/note/:id`
```

---

## 7. 왜 이렇게 설계했는가?

1. **왜 대시보드 API(`GET /api/dashboard/courses`) 하나로 다 주는가?**
   - 만약 `/api/courses`, `/api/notes/recent`, `/api/posts/recent` 이렇게 3개로 쪼개면 프론트엔드가 네트워크 통신을 3번 해야 합니다.
   - 첫 홈 화면은 빠른 로딩이 생명이므로 필요한 최소 요약 데이터를 **단일 집약 API(BFF 패턴 유사)**로 묶어 네트워크 왕복(RTT) 비용을 줄였습니다.

2. **왜 `postRepository.findTop5ByCourseInOrderByCreatedAtDesc(enrolledCourses)`인가?**
   - 과거 리팩터링 계획(`PLANS.md` P1-8)을 보면, 기존에는 전체 학교 게시글 Top 5를 가져와서 **내가 안 듣는 강의의 비밀 글이 대시보드에 노출되는 문제**가 있었습니다.
   - 이를 해결하기 위해 `enrolledCourses`로 조건을 걸어 **내가 수강하는 강의의 글만** 가져오도록 보안 경계를 세웠습니다.

3. **왜 `CourseContext`를 쓰는가?**
   - 사이드바는 모든 페이지(노트 작성 중에도)에 떠 있습니다. 매 페이지 이동마다 강의 목록을 새로 부르면 깜빡임과 서버 부하가 생깁니다.
   - 전역 Context에 보관하여 불필요한 중복 호출을 막습니다.

---

## 8. 초보자가 헷갈리기 쉬운 부분

| 헷갈리는 것 | 실제 동작 |
|---|---|
| 대시보드에서 노트 본문까지 다 가져오나요? | **아닙니다.** `NoteSummaryResponse`에는 `noteId`, `title`, `courseName`, `updatedAt`만 들어 있습니다. 에디터 본문(Tiptap JSON)은 용량이 크기 때문에 실제 그 노트를 클릭해서 열었을 때만 가져옵니다. |
| `readOnly = true` 트랜잭션은 왜 붙이나요? | 조회 전용 로직에 `@Transactional(readOnly = true)`를 붙이면 JPA가 변경 감지(Dirty Checking)를 하지 않아 성능과 메모리 효율이 좋아집니다. |
| 게시글 작성자가 왜 "익명 24"처럼 나오나요? | 익명 게시판 원칙상 실명을 감추되, 같은 글 안에서 누가 쓴 댓글인지 구분하기 위해 학번의 일부 해시/나머지 연산(`studId % 100`)을 붙여 가상 익명 ID를 만듭니다. |

---

## 9. 시험/면접에서 알아야 할 핵심

> **"대시보드 같은 복합 조회 화면을 만들 때 데이터베이스 조회의 N+1 문제나 성능 문제를 어떻게 고려했나요?"**

✅ 이렇게 설명할 수 있습니다:
> "대시보드는 강의, 최근 노트, 최근 게시판이라는 서로 다른 성격의 엔티티를 한 번에 요약해서 보여줍니다. 
> UniNote에서는 첫째, `readOnly = true` 트랜잭션으로 불필요한 스냅샷 메모리를 줄였습니다. 
> 둘째, 무작정 모든 데이터를 가져오지 않고 Spring Data JPA의 파생 쿼리인 `findTop6...` 및 `findTop5...`를 사용해 DB 레벨에서 정렬과 `LIMIT`을 걸어 조회 성능을 최적화했습니다. 
> 셋째, 타 수강생의 게시글이 노출되지 않도록 학생의 수강 강의 리스트(`enrolledCourses`)를 먼저 구한 뒤 SQL의 `IN` 절로 범위를 한정해 권한 검증과 조회를 동시에 해결했습니다."

---

## 10. 이해 확인 문제 📝

**Q1. (쉬운 문제)**
대시보드 우측 화면에 표시되는 '최근 노트 기록'은 최대 몇 개까지 화면에 보이나요?

**Q2. (흐름 문제)**
사용자가 대시보드에서 특정 '최근 노트' 카드를 클릭하면 브라우저는 어떤 URL 경로로 이동하나요?

**Q3. (코드 이해)**
`DashboardService.java`에서 게시글 목록을 가져올 때 `enrolledCourses.isEmpty()`를 체크하는 삼항 연산자가 있습니다. 만약 학생이 아무 강의도 수강하고 있지 않을 때 이 검사가 없다면 SQL 쿼리에서 어떤 문제가 생길 수 있을까요?

**Q4. (설계 이해)**
`DashboardPage.jsx`는 왜 직접 `client.get('/dashboard/courses')`를 부르지 않고 `useCourses()`를 통해 데이터를 가져올까요?

**Q5. (면접형)**
로그인한 사용자 정보를 전달할 때 프론트엔드가 URL 파라미터(`?studentNum=20211234`)로 넘기지 않고, 백엔드에서 `Authentication` 객체를 통해 학번을 추출하는 이유는 보안 관점에서 무엇 때문일까요?
