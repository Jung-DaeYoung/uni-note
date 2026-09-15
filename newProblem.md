# newProblem.md — 범위 밖 발견 사항 모음

PLANS.md 항목들을 순서대로 진행하며 각 단계의 명시된 범위 밖이라 "수정하지 않고 보고만" 한 문제들을 모은 목록이다. 아직 어떤 항목에도 배정되지 않았으며, 코드는 전혀 수정하지 않았다.

## 1. PostService — 소유권 위반과 미존재 리소스가 전부 401로 처리됨

**위치**: `backend/src/main/java/com/uninote/backend/service/PostService.java:25,35,37,53,55,69,73,82,86,95,99,108,112`

**문제**

- "Invalid course ID" / "Invalid post ID" / "Invalid student number" / "Invalid comment ID" (리소스 없음) 과 "작성자 본인만 수정/삭제할 수 있습니다" (소유권 위반) 이 전부 `IllegalArgumentException` 한 가지로 던져진다.
- `GlobalExceptionHandler`가 `IllegalArgumentException`을 401로 매핑하므로, 게시글/댓글이 존재하지 않는 경우도 403이어야 할 소유권 위반도 모두 인증 실패(401)로 응답된다.
- P1-7에서 `NoteService`/`QuizService`/`IncorrectNoteService`에 적용한 것과 동일한 패턴의 문제이며, P1-7의 "위치" 목록에 `PostService.java`가 없어 이번 범위에서 제외했다.

**제안**: 리소스 없음 → `ResourceNotFoundException`(404), 소유권 위반 → `CourseAccessException`(403)으로 재분류.

## 2. QuizService.deleteQuiz — 삭제 권한 위반이 403이 아닌 500

**위치**: `backend/src/main/java/com/uninote/backend/service/QuizService.java:83`

**문제**

- `if (!quizSet.getStudent().getStudId().equals(student.getStudId())) throw new RuntimeException("삭제 권한이 없습니다.");` — 소유권 검증 실패인데 `CourseAccessException`이 아니라 plain `RuntimeException`을 던진다.
- P1-7 적용 후 `GlobalExceptionHandler`의 안전망(`Exception.class` 핸들러)에 걸려 500으로 응답되어, 예전보다는 메시지 노출은 없어졌지만 여전히 403이어야 할 응답이 500으로 나간다.
- P0-3/P0-5/P1-7에서 매번 "범위 밖"으로 확인만 하고 넘어간 항목.

**제안**: `CourseAccessException`으로 교체.

## 3. QuizController — 학생 조회 실패가 8곳에서 전부 미매핑 RuntimeException

**위치**: `backend/src/main/java/com/uninote/backend/controller/QuizController.java:23,31,38,45,54,62,69,76` (deleteQuiz, getQuizDetail, getMyQuizzes, generateQuiz, saveAttempt, getMyAttempts, getAttemptDetail, getAttemptsByQuizSet 전 메서드)

**문제**

- `studentRepository.findByStudentNum(principal.getName()).orElseThrow(() -> new RuntimeException("학생 정보를 찾을 수 없습니다."))` 패턴이 반복된다.
- JWT 인증을 통과한 principal의 studentNum이 DB에 없는 경우는 사실상 거의 발생하지 않지만, 발생 시 `GlobalExceptionHandler`의 안전망에 걸려 500으로 응답 — 다른 컨트롤러와 처리 방식이 다르다.
- P1-7의 "위치" 목록에 컨트롤러 파일이 없어 서비스 계층만 수정하고 이 부분은 그대로 뒀다.

**제안**: `ResourceNotFoundException` 또는 별도 인증 예외로 통일.

## 4. IncorrectNoteController — 동일한 미매핑 RuntimeException 1곳

**위치**: `backend/src/main/java/com/uninote/backend/controller/IncorrectNoteController.java:56`

**문제**: 위 3번과 동일한 `RuntimeException("학생 정보를 찾을 수 없습니다.")` 패턴.

## 5. DashboardService — 학생 조회 실패가 401로 처리됨

**위치**: `backend/src/main/java/com/uninote/backend/service/DashboardService.java:34`

**문제**

- `IllegalArgumentException("학생을 찾을 수 없습니다.")` — 리소스 없음(404에 더 가까움)인데 `GlobalExceptionHandler`에 의해 401로 응답된다.
- P1-7 수정 대상 파일 목록(`GlobalExceptionHandler`/`NoteService`/`QuizService`/`IncorrectNoteService`)에 포함되지 않아 그대로 뒀다.

## 6. `/uploads/{file}` 정적 경로 미보호 (P1-1 잔여 위험, 사용자 확인 완료)

**위치**: `backend/src/main/java/com/uninote/backend/security/SecurityConfig.java` (정적 리소스 매핑), P1-1 작업 당시 논의

**문제**: 서명(HMAC) 없이 파일명을 아는 경우 `/uploads/{file}` 정적 경로로 직접 접근하면 인가 검사를 우회할 수 있다. P1-1 진행 시 사용자에게 명시적으로 보고했고, "의도적으로 남겨두는 잔여 위험"으로 확인받은 항목이라 재수정 대상은 아니지만 문서화 차원에서 다시 기록.

## 7. AI 퀴즈 생성 시 여러 강의 노트 혼입 제한 미적용 (P1-3 잔여)

**위치**: `backend/src/main/java/com/uninote/backend/service/QuizService.java` (`validateNoteAccess`)

**문제**: P1-3에서 노트 소유권/존재 여부는 검증하지만, 서로 다른 강의(course)에 속한 노트들을 한 번에 묶어 퀴즈를 생성하는 것 자체는 막지 않는다("여러 강의 노트가 섞이지 않도록 제한" 요구사항이 원래 P1-3 지시에 있었으나 별도 확인/구현되지 않음).

## 8. `cors.allowed-origins` 운영 프로파일 fail-fast 검증 없음 (P1-6 잔여)

**위치**: `backend/src/main/resources/application-prod.yaml`, `backend/src/main/java/com/uninote/backend/security/SecurityConfig.java`

**문제**: 운영 배포 시 `cors.allowed-origins` 환경변수를 설정하지 않으면 `application.yaml`의 기본값(`http://localhost:5173`)으로 조용히 폴백된다. 운영 기동 시점에 명시적으로 실패시키는 검증 로직이 없다.

## 9. (정보성/저위험) Spring Security "Using generated security password" 부팅 로그

**위치**: 앱 부팅 시 콘솔 (Spring Boot 자동 설정)

**문제**: 커스텀 `JwtFilter`/`SecurityConfig`가 이미 인증을 처리함에도, 특정 조건에서 Spring Boot의 기본 자동 설정이 "Using generated security password" 경고를 출력할 수 있다. 실제 보안 영향은 없는 것으로 보이나(커스텀 인증 경로가 실제로 사용됨), 로그 노이즈로 남아있어 기록.

---

*참고: `AuthService.login()`의 "해당 학번의 학생을 찾을 수 없습니다"/"비밀번호가 일치하지 않습니다" (`AuthService.java:27,51`)는 계정 존재 여부 노출 방지를 위해 401로 통일된 상태를 의도적으로 유지 중이며, 이는 버그가 아니라 P0-1 단계의 보안 설계 결정이므로 이 목록에는 포함하지 않았다.*
