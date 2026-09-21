# 🎓 UniNote 코드 과외 — 1강: 로그인 & 인증 (Authentication)

---

## 1. 이 기능이 무엇인가?

사용자가 **학번과 비밀번호를 입력해서 "나는 누구다"를 서버에 증명**하는 기능입니다.
한 번 로그인에 성공하면, 이후 모든 요청에서 다시 비밀번호를 입력하지 않아도 됩니다.

---

## 2. 왜 필요한가?

UniNote는 **내 강의, 내 노트, 내 퀴즈**처럼 사용자마다 다른 데이터를 보여줘야 합니다.
그러려면 "지금 요청을 보낸 사람이 누구인지"를 서버가 알아야 합니다.
로그인이 없으면 누구나 남의 노트를 볼 수 있게 됩니다.

---

## 3. 전체 동작 흐름

```
사용자가 학번/비밀번호 입력 후 "로그인" 클릭
  ↓
LoginPage.jsx  →  handleLogin() 실행
  ↓
client.js  →  POST /api/auth/login 요청
  ↓
AuthController.java  →  login() 메서드 수신
  ↓
AuthService.java  →  학번으로 학생 조회, 비밀번호 검증, JWT 생성
  ↓
StudentRepository  →  DB에서 students 테이블 조회
  ↓
JWT 토큰을 응답으로 반환
  ↓
LoginPage.jsx  →  토큰을 localStorage에 저장
  ↓
/dashboard 페이지로 이동
```

---

## 4. 실제 코드 위치

**Frontend:**
- `frontend/src/pages/LoginPage.jsx` — 입력 폼 + 로그인 요청
- `frontend/src/context/AuthContext.jsx` — 토큰 저장/관리/공유
- `frontend/src/api/client.js` — Axios 설정, 모든 요청에 토큰 자동 첨부
- `frontend/src/routes/ProtectedRoute.jsx` — 로그인 안 한 사용자 차단

**Backend:**
- `backend/.../controller/AuthController.java` — 요청 수신
- `backend/.../service/AuthService.java` — 비밀번호 검증 + JWT 발급
- `backend/.../security/JwtUtil.java` — JWT 생성/검증
- `backend/.../security/JwtFilter.java` — 모든 요청에서 JWT 자동 검증

**Database:**
- `students` 테이블 — `stud_id`, `student_num`, `name`, `password`

---

## 5. 코드가 실제로 어떻게 실행되는가?

### 🔵 STEP 1. 사용자가 폼을 작성하고 "로그인" 클릭

`LoginPage.jsx`에서 `handleLogin()`이 실행됩니다.

```jsx
// LoginPage.jsx
const [studentNum, setStudentNum] = useState('');
const [password, setPassword] = useState('');

const handleLogin = async (e) => {
  e.preventDefault();          // 폼의 기본 새로고침 동작을 막는다
  setIsLoading(true);          // 버튼을 "인증 중..."으로 바꾼다
  try {
    const response = await client.post('/auth/login', { studentNum, password });
    const { token } = response.data;
    login(token);              // 토큰을 저장한다
    navigate('/dashboard');    // 대시보드로 이동한다
  } catch (error) {
    alert('로그인에 실패했습니다...');
  }
};
```

> 💬 **쉽게 말하면**: 사용자가 입력한 학번과 비밀번호를 `{ studentNum, password }` 라는 상자에 담아서 서버로 보내는 코드입니다.

---

### 🔵 STEP 2. Axios가 서버로 요청을 보낸다

`client.js`에는 Axios 설정이 있습니다.

> **Axios가 뭔가요?**
> 브라우저에서 서버로 HTTP 요청(데이터 주고받기)을 쉽게 할 수 있게 해주는 라이브러리입니다. 마치 **배달 앱**처럼, "이 데이터를 저 서버로 보내줘"라고 시키면 알아서 보내줍니다.

```js
// client.js
const client = axios.create({
  baseURL: `${API_BASE_URL}/api`,  // 모든 요청의 기본 주소
});
```

> 💬 **쉽게 말하면**: `client.post('/auth/login', ...)`라고 쓰면, 실제로는 `http://localhost:8080/api/auth/login`으로 요청이 전송됩니다.

---

### 🔵 STEP 3. 백엔드 AuthController가 요청을 받는다

`AuthController.java`:

```java
@PostMapping("/login")
public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
    String token = authService.login(request);
    return ResponseEntity.ok(new LoginResponse(token, request.getStudentNum()));
}
```

> 💬 **쉽게 말하면**: 프론트에서 보낸 `{ studentNum, password }` 데이터를 `LoginRequest` 상자에 받아서, `AuthService`에게 "이 사람 로그인 처리해줘"라고 넘깁니다.

> **`@RequestBody`가 뭔가요?**
> HTTP 요청의 본문(body)에 담긴 JSON 데이터를 Java 객체로 자동 변환해주는 어노테이션입니다.

---

### 🔵 STEP 4. AuthService가 비밀번호를 검증하고 JWT를 만든다

`AuthService.java`:

```java
// 1. DB에서 학번으로 학생을 찾는다
Student student = studentRepository.findByStudentNum(loginRequest.getStudentNum())
        .orElseThrow(() -> new IllegalArgumentException("해당 학번의 학생을 찾을 수 없습니다."));

// 2. 비밀번호가 맞는지 확인한다
boolean passwordMatches;
if (isBcryptHash(storedPassword)) {
    passwordMatches = passwordEncoder.matches(rawPassword, storedPassword); // 해시 비교
} else {
    // 레거시 평문 비밀번호: 일치하면 즉시 BCrypt 해시로 전환
    passwordMatches = rawPassword.equals(storedPassword);
    if (passwordMatches) {
        student.setPassword(passwordEncoder.encode(rawPassword));
        studentRepository.save(student);
    }
}

// 3. 맞으면 JWT 토큰을 발급한다
return jwtUtil.generateToken(student.getStudentNum());
```

> 💬 **쉽게 말하면**: DB에서 그 학번의 사람을 찾아 → 비밀번호를 비교해 → 맞으면 "입장권(JWT)"을 발급하는 과정입니다.

> **BCrypt가 뭔가요?**
> 비밀번호를 저장할 때 "1234" 그대로 저장하면 DB가 해킹당했을 때 바로 털립니다. BCrypt는 비밀번호를 `$2a$10$xxxx...` 형태의 알아볼 수 없는 문자열로 변환해서 저장합니다. 비교할 때는 입력값을 같은 방식으로 변환해서 저장된 값과 맞춥니다.

---

### 🔵 STEP 5. JWT가 만들어진다

`JwtUtil.java`:

```java
public String generateToken(String studentNum) {
    return Jwts.builder()
            .subject(studentNum)        // "이 토큰의 주인은 이 학번이다"
            .issuedAt(new Date())       // 발급 시각
            .expiration(new Date(...))  // 만료 시각
            .signWith(secretKey)        // 서버만 아는 비밀키로 서명
            .compact();                 // 문자열로 변환
}
```

> **JWT가 뭔가요?**
> "JSON Web Token"의 줄임말입니다. 놀이공원 **손목 팔찌**와 비슷합니다. 입장할 때 한 번 검사받고 팔찌를 차면, 그 이후엔 팔찌만 보여줘도 입장이 가능합니다. JWT도 마찬가지로, 한 번 로그인하면 이 토큰을 가지고 다니면서 "나 인증된 사람이야"라고 증명합니다.

JWT의 생김새:
```
eyJhbGciOiJIUzI1NiJ9       ← Header (어떤 방식으로 만들었는지)
.eyJzdWIiOiIyMDIxMTIzNCJ9  ← Payload (학번 등 정보)
.SflKxwRJSMeKKF2QT4fwpMeJ  ← Signature (위조 방지 서명)
```

---

### 🔵 STEP 6. 프론트가 토큰을 저장하고 이후 요청에 자동으로 첨부한다

`AuthContext.jsx`:

```jsx
const login = useCallback((newToken) => {
    if (!isTokenValid(newToken)) return;     // 유효하지 않은 토큰은 저장 안 함
    localStorage.setItem('token', newToken); // 브라우저에 저장
    setToken(newToken);                      // React 상태 업데이트
}, []);
```

`client.js`:

```js
// 모든 요청에 자동으로 토큰을 붙인다
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

> 💬 **쉽게 말하면**: 토큰을 `localStorage`(브라우저의 메모장)에 저장해두고, 이후 모든 API 요청마다 "저 이 팔찌 있어요"라고 자동으로 보여주는 코드입니다.

---

### 🔵 STEP 7. 이후 요청마다 서버가 JwtFilter로 토큰을 검증한다

`JwtFilter.java`:

```java
// 모든 HTTP 요청마다 실행된다
String authHeader = request.getHeader("Authorization");
if (authHeader != null && authHeader.startsWith("Bearer ")) {
    String token = authHeader.substring(7); // "Bearer " 이후의 실제 토큰
    if (jwtUtil.validateToken(token)) {
        String studentNum = jwtUtil.getStudentNum(token);
        // "이 요청을 보낸 사람은 이 학번이다"라고 Spring Security에 등록
        SecurityContextHolder.getContext().setAuthentication(...);
    }
}
```

> 💬 **쉽게 말하면**: 서버 입구에 서 있는 **경비원**입니다. 모든 요청이 들어올 때마다 팔찌(토큰)를 확인하고, 유효하면 "이 사람은 `2021xxxx` 학번"이라고 기록해둡니다. 그러면 이후 Controller에서 `@AuthenticationPrincipal`로 학번을 꺼낼 수 있게 됩니다.

---

### 🔵 STEP 8. ProtectedRoute로 비로그인 사용자를 차단한다

`ProtectedRoute.jsx`:

```jsx
const ProtectedRoute = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />; // 로그인 안 했으면 /login으로 강제 이동
  }

  return <Outlet />; // 로그인 했으면 정상적으로 페이지 표시
};
```

> 💬 **쉽게 말하면**: 대시보드, 노트, 퀴즈 등 모든 페이지 앞에 세워둔 **문지기**입니다. `isAuthenticated`가 `false`면 아예 들여보내지 않고 로그인 페이지로 돌려보냅니다.

---

## 6. 데이터가 어떻게 이동하는가?

```
사용자 입력
  { studentNum: "20211234", password: "1234" }
          ↓
React state (useState)
  studentNum, password 변수에 저장
          ↓
API Request (Axios POST)
  POST /api/auth/login
  Body: { "studentNum": "20211234", "password": "1234" }
          ↓
Controller → LoginRequest DTO
  loginRequest.getStudentNum() = "20211234"
  loginRequest.getPassword()  = "1234"
          ↓
Service → Student Entity 조회
  DB: SELECT * FROM students WHERE student_num = '20211234'
          ↓
JWT 생성 (JwtUtil)
  subject = "20211234", exp = 지금+24시간
          ↓
API Response
  { "token": "eyJhbGci...", "studentNum": "20211234" }
          ↓
React 화면
  localStorage에 토큰 저장 → /dashboard 이동
```

---

## 7. 왜 이렇게 설계했는가?

### Controller와 Service를 왜 나눴나?
- **Controller**: "HTTP 요청을 받아서 넘기는 창구"만 담당합니다.
- **Service**: "실제 비즈니스 로직(학생 찾기, 비밀번호 확인, 토큰 발급)"을 담당합니다.
- 만약 나중에 로그인 방식이 바뀌어도 Controller는 건드리지 않아도 됩니다.

### 왜 JWT인가?
- 서버가 로그인 상태를 **직접 기억하지 않아도 됩니다** (Stateless).
- 토큰 자체에 "누구인지"가 담겨 있어서, 서버를 여러 대 운영해도 문제없습니다.
- 세션(서버가 기억하는 방식)에 비해 서버 자원 소모가 적습니다.

### 왜 localStorage인가?
- 탭을 닫아도, 브라우저를 재시작해도 토큰이 유지됩니다.
- 단, XSS 공격에 취약한 단점이 있습니다.
- UniNote의 `PLANS.md` P3-7에 "나중에 httpOnly 쿠키로 전환을 검토한다"고 기록되어 있습니다.

### 왜 AuthContext를 쓰는가?
- `token`과 `isAuthenticated`를 **앱 전체에서 공유**해야 하기 때문입니다.
- Context 없이는 모든 컴포넌트가 localStorage를 직접 읽어야 해서 코드가 복잡해집니다.

---

## 8. 초보자가 헷갈리기 쉬운 부분

| 헷갈리는 것 | 실제 의미 |
|---|---|
| `Bearer 토큰` | HTTP 인증 방식의 이름. `"Bearer "` + 실제 토큰 값을 붙여서 보냄 |
| `localStorage` vs 쿠키 | localStorage는 JS로 읽기 가능, 쿠키는 httpOnly 설정 시 JS로 읽기 불가 |
| `isAuthenticated` | 토큰이 있고 만료되지 않았으면 `true`. 별도 상태가 아니라 `token !== null`에서 파생됨 |
| `interceptors` | 모든 요청/응답에 공통으로 실행되는 미들웨어. 여기서 토큰 자동 첨부·401 처리를 함 |
| `SecurityContextHolder` | Spring이 "현재 요청을 보낸 사람 정보"를 보관하는 곳. JwtFilter가 여기에 학번을 저장하면 Controller에서 꺼낼 수 있음 |

---

## 9. 시험/면접에서 알아야 할 핵심

> **"UniNote에서 인증은 어떻게 구현했나요?"**

✅ 이렇게 답할 수 있어야 합니다:

> "JWT 기반 Stateless 인증을 사용합니다. 사용자가 로그인하면 서버의 `AuthService`가 DB에서 학생을 조회하고 BCrypt로 비밀번호를 검증한 뒤, `JwtUtil`로 토큰을 발급합니다. 프론트엔드는 이 토큰을 localStorage에 저장하고, 이후 모든 API 요청에서 Axios의 request interceptor가 `Authorization: Bearer <token>` 헤더를 자동으로 붙입니다. 서버에서는 `JwtFilter`가 모든 요청마다 이 토큰을 검증하고, 유효하면 학번을 `SecurityContextHolder`에 등록해서 Controller에서 `@AuthenticationPrincipal`로 꺼낼 수 있게 합니다."

---

## 10. 이해 확인 문제 📝

**Q1. (쉬운 문제)**
사용자가 로그인에 성공했을 때, 토큰은 어디에 저장되나요?

**Q2. (흐름 문제)**
사용자가 "로그인" 버튼을 클릭한 뒤, 대시보드로 이동하기까지 거치는 파일들을 순서대로 나열해보세요.

**Q3. (코드 이해)**
`JwtFilter.java`에서 `authHeader.substring(7)`을 하는 이유는 무엇인가요?

**Q4. (설계 이해)**
`AuthService`에서 비밀번호를 DB에 그대로 저장하지 않고 BCrypt로 저장하는 이유는 무엇인가요?

**Q5. (면접형)**
JWT의 장점이 세션 방식에 비해 무엇인지, UniNote 프로젝트를 예시로 설명해보세요.
