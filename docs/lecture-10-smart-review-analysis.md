# 🎓 UniNote 코드 과외 — 10강: 스마트 오답 복습, 취약 개념 분석 & 프론트 테마 시스템

---

## 1. 이 기능이 무엇인가?

학생이 그동안 풀었던 모든 시험/오답 문제 풀이 이력(`UserAnswer`)을 통계적으로 분석하여, **내가 어떤 과목과 어떤 문제 유형에 취약한지 시각화하고, 복습 우선순위(HIGH/MEDIUM/LOW) 알고리즘을 통해 매일 "오늘의 복습 문제"를 자동으로 큐에 채워주는 스마트 학습 분석 시스템**입니다.  
더불어 심야 학습 시 눈의 피로를 덜어주는 **Tailwind v4 기반 전역 다크모드(`ThemeContext`) 및 다중 탭 동기화 아키텍처**를 다룹니다.

---

## 2. 왜 필요한가?

1. **시간 낭비 없는 타겟팅 복습**: 이미 잘 아는 문제를 열 번 푸는 것은 학습 효율이 떨어집니다. 반면 2번 이상 반복해서 틀리거나 최근에 틀린 문제는 망각하기 전에 바로 다시 풀어야 합니다.
2. **학습 취약점 메타인지 제공**: "내가 운영체제는 90% 맞히는데, 자료구조 단답형은 정답률이 30%밖에 안 되는구나!"라는 객관적 데이터 지표(과목별/유형별 정답률)를 학생에게 보여주어야 합니다.
3. **데이터 정합성 및 성능 최적화**: 수천 개의 풀이 이력을 화면에 띄울 때마다 무거운 SELECT 쿼리를 여러 번 날리면 서버 DB가 뻗습니다. **단 1번의 최적화된 SQL GROUP BY 프로젝션**으로 모든 통계를 오차 없이 일치시켜야 합니다.

---

## 3. 전체 동작 흐름

```
[1. 스마트 오답 분석 & 복습 추천 흐름]
1. 학생이 퀴즈 라이브러리 / 오답노트 페이지 접속
  ↓
2. IncorrectNoteService.getSummary() 및 getTodayReview() 호출
  ↓
3. UserAnswerRepository.aggregateByQuestionForStudent(studId) 실행:
   - 학생의 모든 풀이 답안을 대상(정규 퀴즈 + 가상 오답 세션 전체)으로
   - 단 1번의 JPA GROUP BY 쿼리로 문항별 총 시도수, 정답수, 오답수, 최근 오답일시 집계!
  ↓
4. IncorrectNoteService 메모리 분류 및 우선순위 랭킹 산출:
   - 최근 오답 OR 2회 이상 오답 OR 정답률 < 50% → [HIGH] 부여
   - 50% <= 정답률 < 75% → [MEDIUM] 부여
   - 정렬: 반복 오답수 desc → 최근 오답 여부 desc → 오래전에 푼 것 asc
  ↓
5. "오늘의 복습" 큐 생성 (HIGH/MEDIUM 우선 최대 N문항 추천)
  ↓
6. 학생이 "오늘의 복습 풀기" 클릭 시 즉시 9강의 CBTPlayer로 연결!

-------------------------------------------------------------------------
[2. 전역 다크모드(Theme) 흐름]
1. 사용자가 상단 사이드바의 "달/해" 아이콘 클릭
  ↓
2. ThemeContext.toggleTheme() 실행:
   - theme 상태가 'light' ↔ 'dark' 토글
   - 최상위 <html> 태그에 .dark 클래스 추가/제거
   - localStorage에 'uninote-theme' 키로 저장
  ↓
3. window 'storage' 이벤트 리스너 동작:
   - 다른 브라우저 탭에서도 새로고침 없이 즉시 다크모드로 실시간 동기화!
```

---

## 4. 실제 코드 위치

**Backend (분석 & 추천 코어):**
- `backend/.../repository/UserAnswerRepository.java` — `aggregateByQuestionForStudent()` (GROUP BY 프로젝션 단일 쿼리)
- `backend/.../repository/QuestionAnswerStat.java` — Spring Data JPA 인터페이스 프로젝션 DTO
- `backend/.../service/IncorrectNoteService.java` — 복습 우선순위 산출(`classifyPriority`), 과목별/유형별 통계 집계, 오늘의 복습 큐
- `backend/.../controller/IncorrectNoteController.java` — 통계 요약, 과목별 통계, 유형별 통계, 오늘의 복습 API 엔드포인트

**Frontend (테마 & 시각화):**
- `frontend/src/context/ThemeContext.jsx` — Tailwind v4 전역 다크모드 컨텍스트, `localStorage` 유지, 다중 탭 동기화
- `frontend/src/pages/QuizLibraryPage.jsx` — 퀴즈 목록, 최근 풀이 기록, 오답노트 통계 탭을 아우르는 메인 라이브러리
- `frontend/src/components/quiz/QuizHistoryPanel.jsx` — 과거 풀이 이력 목록 및 회차별 리포트 모달 연결

---

## 5. 코드가 실제로 어떻게 실행되는가?

### 🔵 STEP 1. 단 1번의 GROUP BY 프로젝션 쿼리 (`UserAnswerRepository.java`)

여러 화면에서 보여주는 통계(전체 정답률, 강의별 정답률, 유형별 정답률, 오늘의 복습 대상)를 개별 쿼리로 구하면 숫자가 서로 어긋나거나 DB 부하가 커집니다.  
UniNote는 **Spring Data JPA 인터페이스 프로젝션**을 사용해 단 1번의 쿼리로 학생의 모든 풀이 통계를 완벽하게 뽑아냅니다.

`UserAnswerRepository.java`:

```java
@Repository
public interface UserAnswerRepository extends JpaRepository<UserAnswer, Long> {

    // 🔒 학생 1명의 모든 답안을 문제 단위로 완벽 집계 (가상 세션 포함)
    @Query("SELECT q.questionId AS questionId, " +
           "c.courseId AS courseId, c.courseName AS courseName, q.type AS type, " +
           "COUNT(ua) AS attemptCount, " +
           "SUM(CASE WHEN ua.isCorrect = true THEN 1L ELSE 0L END) AS correctCount, " +
           "SUM(CASE WHEN ua.isCorrect = false THEN 1L ELSE 0L END) AS incorrectCount, " +
           "MAX(ua.quizAttempt.startTime) AS lastAttemptedAt, " +
           "MAX(CASE WHEN ua.isCorrect = false THEN ua.quizAttempt.startTime ELSE NULL END) AS lastIncorrectAt " +
           "FROM UserAnswer ua JOIN ua.question q JOIN q.quizSet qs LEFT JOIN qs.course c " +
           "WHERE ua.quizAttempt.student.studId = :studId " +
           "GROUP BY q.questionId, c.courseId, c.courseName, q.type")
    List<QuestionAnswerStat> aggregateByQuestionForStudent(@Param("studId") Long studId);
}
```

> **왜 `LEFT JOIN qs.course`인가요?**  
> 9강에서 배운 오답노트 재풀이처럼 가상 세션으로 푼 문제는 특정 단일 강의가 연결되어 있지 않을 수 있습니다. 일반 inner join을 쓰면 강의 정보가 없는 문제가 집계에서 통째로 증발하므로, 반드시 `LEFT JOIN`으로 누락을 방지했습니다.

> 💬 **쉽게 말하면**: "이 학생이 지금까지 푼 모든 답안지를 1초 만에 훑어서, 각 문제마다 몇 번 풀었고 몇 번 틀렸으며 가장 최근에 언제 틀렸는지를 표 하나(`QuestionAnswerStat`)로 압축 정리해오는 초강력 SQL"입니다.

---

### 🔵 STEP 2. 스마트 복습 우선순위 산출 알고리즘

집계된 데이터를 바탕으로 각 문제에 **긴급 복습 라벨(HIGH/MEDIUM/LOW)**을 부여합니다.

`IncorrectNoteService.java`:

```java
private ReviewPriority classifyPriority(long incorrectCount, double accuracyRate, boolean recentlyIncorrect) {
    boolean repeatIncorrect = incorrectCount >= 2; // 2회 이상 틀린 문제

    // [HIGH]: 방금 막 틀렸거나, 2번 이상 반복해서 틀렸거나, 정답률이 50% 미만인 취약 문제!
    if (recentlyIncorrect || repeatIncorrect || accuracyRate < 0.5) {
        return ReviewPriority.HIGH;
    }
    // [MEDIUM]: 정답률이 50%~75% 사이로 아직 아리송한 문제
    if (accuracyRate < 0.75) {
        return ReviewPriority.MEDIUM;
    }
    // [LOW]: 정답률 75% 이상으로 충분히 숙달된 문제
    return ReviewPriority.LOW;
}

// 복습 추천 정렬 기준:
// 1. 반복 오답 수 많은 순 (desc)
// 2. 가장 최근 풀이에서 틀린 문제 우선 (desc)
// 3. 푼 지 오래된 문제 우선 (asc - 에빙하우스 망각곡선 반영!)
private static final Comparator<QuestionReviewStat> PRIORITY_ORDER = Comparator
    .comparingLong(QuestionReviewStat::getIncorrectCount).reversed()
    .thenComparing(QuestionReviewStat::isRecentlyIncorrect, Comparator.reverseOrder())
    .thenComparing(QuestionReviewStat::getLastAttemptedAt, Comparator.nullsLast(Comparator.naturalOrder()))
    .thenComparing(s -> s.getQuestion().getQuestionId());
```

> 💬 **쉽게 말하면**: "어제도 틀리고 오늘도 틀린 문제(반복 오답)를 1등으로 복습시키고, 그다음엔 푼 지 오래되어 가물가물한 문제를 먼저 추천해 주는 에빙하우스 망각곡선형 똑똑한 과외 선생님 알고리즘"입니다.

---

### 🔵 STEP 3. "오늘의 복습" 추천 큐 생성 (`getTodayReview`)

`IncorrectNoteService.java`:

```java
@Transactional(readOnly = true)
public List<TodayReviewQuestionResponse> getTodayReview(Student student, int limit, Long courseId) {
    return buildQuestionReviewStats(student).stream()
        .filter(s -> s.getReviewPriority() != ReviewPriority.LOW) // 숙달된 LOW 문제는 제외!
        .filter(s -> courseId == null || courseId.equals(s.getCourseId())) // 특정 과목 필터
        .limit(limit) // 요청한 개수만큼 슬라이스 (기본 10~20문제)
        .map(s -> TodayReviewQuestionResponse.builder()
            .question(questionResponseMapper.toResponse(s.getQuestion()))
            .courseId(s.getCourseId())
            .courseName(s.getCourseName())
            .attemptCount(s.getAttemptCount())
            .incorrectCount(s.getIncorrectCount())
            .lastIncorrectAt(s.getLastIncorrectAt())
            .reviewPriority(s.getReviewPriority())
            .build())
        .collect(Collectors.toList());
}
```

> 💬 **쉽게 말하면**: 학생이 아침에 UniNote를 켰을 때 "오늘 풀어야 할 취약 문제 10개"가 딱 세팅되어 있어서, 고민할 필요 없이 [오늘의 복습 풀기] 버튼만 누르면 바로 약점을 극복할 수 있습니다.

---

### 🔵 STEP 4. 과목별 취약도 랭킹 자동 분석 (`getCourseStatistics`)

`IncorrectNoteService.java`:

```java
@Transactional(readOnly = true)
public List<CourseIncorrectStatResponse> getCourseStatistics(Student student) {
    List<QuestionReviewStat> stats = buildQuestionReviewStats(student);

    return stats.stream()
        .filter(s -> s.getCourseId() != null)
        .collect(Collectors.groupingBy(QuestionReviewStat::getCourseId))
        .values().stream()
        .map(group -> {
            ...
            return CourseIncorrectStatResponse.builder()
                .courseName(first.getCourseName())
                .accuracyRate(attempts == 0 ? 0.0 : (double) correct / attempts)
                .reviewTargetCount(reviewTargetCount) // 복습해야 할 문제 수
                .build();
        })
        .sorted(Comparator.comparingDouble(CourseIncorrectStatResponse::getAccuracyRate)) // 정답률 가장 낮은 취약 과목이 맨 위로!
        .collect(Collectors.toList());
}
```

> 💬 **쉽게 말하면**: 내가 수강 중인 과목들을 '가장 성적이 안 나오는 과목(정답률 최저)' 순서대로 줄을 세워주어, 이번 시험 기간에 어떤 과목에 시간을 더 쏟아야 하는지 한눈에 진단해 줍니다.

---

### 🔵 STEP 5. Tailwind v4 전역 다크모드 및 다중 탭 동기화 (`ThemeContext.jsx`)

야간 학습에 필수적인 다크모드를 구현할 때, 깜빡임(FOUC)과 다중 탭 불일치 문제를 해결한 모범적인 프론트엔드 패턴입니다.

`ThemeContext.jsx`:

```jsx
export const ThemeProvider = ({ children }) => {
  // 1. 새로고침 시 깜빡임 방지: 초기 상태를 localStorage에서 즉시 동기적으로 읽기!
  const [theme, setTheme] = useState(() => readStoredTheme());

  // 2. 테마 변경 시 최상위 <html>의 classList와 localStorage 동기화
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // 3. ⭐ 핵심: 사용자가 1번 탭에서 다크모드를 켜면, 2번 탭도 새로고침 없이 즉시 반응!
  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      setTheme(event.newValue === 'dark' ? 'dark' : 'light');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleTheme = useCallback(() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')), []);
  ...
```

> 💬 **쉽게 말하면**: 브라우저 탭을 3개 띄워놓고 공부하다가 한쪽 탭에서 "다크모드"를 켜면, 나머지 2개 탭도 눈치껏 실시간으로 검은색 화면으로 싹 바뀝니다. 브라우저의 `window.onstorage` 브로드캐스트 이벤트를 활용한 덕분입니다.

---

### 🔵 STEP 6. UniNote 전체 1강~10강 풀스택 아키텍처 총정리

UniNote는 다음과 같이 톱니바퀴처럼 완벽하게 맞물려 동작합니다:

```
[1강] 로그인/JWT 발급 ──→ [2강] 대시보드 홈 개인화 허브
                                ↓
                        [3강] 강의 진입 & 계층형 트리(NoteTree)
                                ↓
                        [4강] Tiptap 에디터 작성 & 2초 디바운스 자동 저장
                        [5강] Slash Command (/)로 문서 구조화 & BlockId 부여
                        [6강] 도표/자료 안전 업로드 (매직바이트 & HMAC 서명 URL)
                        [7강] 모르는 개념 우측 익명 커뮤니티(Drawer)에서 질문
                                ↓
                        [8강] 에디터에서 "AI 문제 생성" (Gemini Structured Outputs)
                                ↓
                        [9강] CBT 시험 풀이, 서버 채점 & 오답노트 스크랩
                                ↓
                        [10강] 스마트 통계 분석 & "오늘의 복습" 추천 큐 가동!
```

---

## 6. 데이터가 어떻게 이동하는가?

```
[학생: 대시보드 또는 오답노트 진입]
       ↓
[React 프론트엔드]
   GET /api/incorrect-notes/today-review?limit=10 (헤더: Bearer JWT 토큰)
       ↓
[IncorrectNoteController] ── Principal 학번 확보
       ↓
[IncorrectNoteService]
       ↓
[UserAnswerRepository.aggregateByQuestionForStudent(studId)]
   - SQL: SELECT q.id, COUNT(ua), SUM(is_correct), MAX(ua.start_time)... GROUP BY q.id
       ↓
[List<QuestionAnswerStat>] (1회 쿼리 결과 반환)
       ↓
[Java Stream 메모리 분류]
   - classifyPriority(): HIGH/MEDIUM/LOW 판정
   - PRIORITY_ORDER 정렬: 오답 2회 이상 → 최근 오답 → 오래된 풀이
   - .limit(10) 추출
       ↓ 200 OK
[TodayReviewQuestionResponse 리스트 응답]
       ↓
[QuizLibraryPage UI]
   - "오늘의 복습 (10문제 남음)" 카드 렌더링
   - 테마 토글 시 ThemeContext를 통해 dark:bg-slate-900 즉각 반응!
```

---

## 7. 왜 이렇게 설계했는가?

1. **왜 개별 통계 쿼리를 여러 번 날리지 않고 `QuestionAnswerStat` 단일 프로젝션으로 묶었는가?**
   - 만약 전체 통계 쿼리, 과목별 쿼리, 유형별 쿼리를 따로 날리면 쿼리 실행 사이에 학생이 새 문제를 푸는 순간 숫자가 서로 맞지 않는 **데이터 불일치(Inconsistency)** 현상이 일어납니다.
   - 1번의 원자적 GROUP BY 집계 결과를 메모리에서 Java Stream으로 가공하면 **쿼리 1회로 성능을 극대화하면서 데이터 정합성을 100% 보장**할 수 있습니다.

2. **왜 복잡한 AI 머신러닝 대신 규칙 기반(Rule-based) 우선순위를 사용했는가?**
   - 추천 시스템에 복잡한 머신러닝 모델을 쓰면 "내가 왜 이 문제를 지금 풀어야 하는지" 학생이 납득하기 어렵고 서버 연산 비용이 듭니다.
   - "반복 오답, 정답률 50% 미만, 오래전에 푼 문제"라는 명확한 규칙을 적용하면 학생에게 **"이 문제는 2번 틀렸던 취약 문제라 추천되었습니다"**라는 명쾌한 설명력(Explainability)을 제공할 수 있습니다.

3. **왜 `window.addEventListener('storage')`로 다중 탭 테마를 동기화했는가?**
   - 웹 애플리케이션에서 사용자는 강의실 탭과 퀴즈 탭을 여러 개 띄워놓고 공부합니다.
   - 한 탭에서 눈이 부셔서 다크모드를 켰는데 다른 탭으로 갔을 때 하얀 화면이 켜지면 시각적 불쾌감을 줍니다. 브라우저 저장소 이벤트를 활용해 브라우저 윈도우 간 완벽한 동기화를 달성했습니다.

---

## 8. 초보자가 헷갈리기 쉬운 부분

| 헷갈리는 것 | 실제 동작 |
|---|---|
| JPA 인터페이스 프로젝션(`QuestionAnswerStat`)이란? | 별도의 DTO 클래스를 만들지 않고 인터페이스의 Getter 메서드명(`getQuestionId()`)을 선언해 두면, Spring Data JPA가 SQL AS 별칭과 매핑하여 프록시 객체로 채워주는 고성능 조회 기술입니다. |
| Tailwind v4의 다크모드 동작 원리 | 최상위 `<html class="dark">` 태그에 클래스가 붙으면, 모든 하위 컴포넌트의 `dark:bg-slate-900`, `dark:text-white` 스타일이 CSS 조상 선택자 메커니즘에 의해 일괄 활성화됩니다. |
| `window.onstorage`는 현재 탭에서도 실행되나요? | **실행되지 않습니다.** 웹 표준 스펙상 `storage` 이벤트는 값을 바꾼 바로 그 탭에서는 실행되지 않고, **'동일한 도메인의 다른 탭들'**에만 브로드캐스트 전파됩니다. |

---

## 9. 시험/면접에서 알아야 할 핵심

> **"학습 플랫폼에서 대량의 풀이 이력 데이터를 집계하고 추천 큐를 만들 때 성능과 데이터 일관성을 어떻게 확보했나요?"**

✅ 이렇게 설명할 수 있습니다:
> "가장 중요한 과제는 **데이터베이스 부하 최소화**와 **화면 간 통계 수치의 정합성 보장**이었습니다.  
> UniNote에서는 전체 요약, 과목별 취약도, 문제 유형별 분석, 오늘의 복습 큐가 모두 제각각 DB를 조회하지 않고, `UserAnswerRepository`의 **GROUP BY 단일 집계 프로젝션(`QuestionAnswerStat`)** 1회 호출 결과를 공유하도록 아키텍처를 일원화했습니다. 이를 통해 N+1 쿼리와 통계 수치 불일치 문제를 원천 차단했습니다.  
> 또한 복습 추천 큐는 에빙하우스 망각곡선 원리를 차용하여 '반복 오답 수', '최근 오답 여부', '최종 풀이 경과 시간'을 조합한 **규칙 기반 우선순위(HIGH/MEDIUM/LOW)** 분류기를 설계하여 연산 비용을 최소화하면서도 학생에게 설득력 있는 맞춤형 복습 경로를 제공했습니다."

---

## 10. 이해 확인 문제 📝

**Q1. (쉬운 문제)**  
UniNote의 복습 우선순위 산출 공식에서 [HIGH] 우선순위가 부여되는 3가지 조건(하나라도 만족 시)은 무엇인가요?

**Q2. (흐름 문제)**  
학생이 브라우저 A탭에서 다크모드로 전환했을 때, B탭이 새로고침 없이도 자동으로 다크모드로 전환되는 브라우저 이벤트 메커니즘은 무엇인가요?

**Q3. (코드 이해)**  
`UserAnswerRepository.java`의 JPQL 쿼리에서 `JOIN q.quizSet qs LEFT JOIN qs.course c`를 사용할 때, 왜 `course`에 대해서는 INNER JOIN이 아닌 LEFT JOIN을 사용했나요?

**Q4. (설계 이해)**  
전체 통계, 과목별 통계, 유형별 통계를 구할 때 각각 별도의 SELECT COUNT 쿼리를 날리지 않고 `buildQuestionReviewStats()` 내부에서 1번의 집계 프로젝션을 수행한 뒤 Java Stream으로 그룹핑하는 이유는 무엇인가요?

**Q5. (면접형 - 1강부터 10강 총정리)**  
UniNote 프로젝트에서 학생이 **'노트 필기(Tiptap) → AI 퀴즈 출제(Gemini) → CBT 풀이 및 채점(Server) → 오답 복습(Smart Queue)'**으로 이어지는 전체 라이프사이클 동안, 데이터 무결성과 보안을 유지하기 위해 각 단계마다 어떤 기술적 장치가 마련되어 있는지 종합적으로 설명해 보세요.
