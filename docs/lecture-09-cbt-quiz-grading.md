# 🎓 UniNote 코드 과외 — 9강: CBT 퀴즈 풀이, 서버 채점 & 오답노트 기초

---

## 1. 이 기능이 무엇인가?

8강에서 AI가 생성한 시험지를 **컴퓨터 기반 시험(CBT, Computer-Based Testing) 환경에서 한 문제씩 집중해서 풀고, 제출 즉시 서버가 엄격하게 자동 채점하여 점수를 매기며, 틀린 문제는 나만의 오답노트 폴더에 담아 무한히 재시험을 볼 수 있는 기능**입니다.

---

## 2. 왜 필요한가?

1. **실전 시험 적응력 (CBT UX)**: 종이 시험과 달리 공무원 시험, 자격증 시험(기사), 대학 e-러닝 평가는 모두 컴퓨터 화면에서 1문제씩 넘겨가며 푸는 CBT 방식입니다. UniNote는 실제 시험과 동일한 집중도 높은 UI를 제공합니다.
2. **점수 위변조 방지 (보안)**: 만약 브라우저(클라이언트)가 "나 100점 맞았어!"라고 점수를 계산해서 서버로 보낸다면, 해커가 F12 개발자 도구로 점수를 100점으로 조작해 서버에 기록할 수 있습니다. **채점은 반드시 서버가 수행**해야 합니다.
3. **오답의 체계적 관리 & 재학습**: 한 번 틀린 문제는 다시 틀릴 확률이 80%가 넘습니다. 시험이 끝난 뒤 틀린 문제만 모아 오답노트 그룹(예: "중간고사 킬러문항 모음")에 스크랩하고, 그 오답들만 모아서 **가상 재시험 세션**을 즉시 치를 수 있어야 합니다.

---

## 3. 전체 동작 흐름

```
[1. CBT 시험 응시]
1. 사용자가 퀴즈 풀기 시작 (CBTPlayer 모달 구동)
  ↓
2. 한 문제씩 보기를 선택(handleSelect)하며 [이전] / [다음] 버튼으로 탐색
  ↓
3. 마지막 문제에서 "답안 제출" 클릭
  ↓
4. 클라이언트는 자신이 계산한 점수를 보내지 않고,
   오직 사용자가 고른 답안 리스트(questionId, submittedAnswer)만 담아 POST /api/quiz/attempts 전송

[2. 서버 자동 채점]
5. QuizService.saveAttempt() 수신:
   - 학생 소유의 퀴즈/문제인지 검증
   - DB에 저장된 실제 정답과 제출 답안을 공백·대소문자 무시(isAnswerCorrect) 대조
   - 서버가 맞힌 개수(score)를 직접 카운트!
  ↓
6. DB 영속화:
   - QuizAttempt(풀이 회차, 총점, 응시시간) 저장
   - UserAnswer(문제별 제출답안, 정답여부 boolean) 저장
  ↓
7. 200 OK 응답 수신

[3. 결과 리포트 & 오답노트 스크랩]
8. CBTPlayer가 즉시 "학습 결과 리포트" 화면으로 전환:
   - 각 문항별 정답/오답 표시, AI 해설 제공
   - [출처 보기] 클릭 시 → 해당 노트의 해당 필기 문단으로 즉시 스크롤 워프!
   - [오답노트에 담기] 클릭 → IncorrectNoteModal을 통해 "중간고사 대비" 그룹에 저장
  ↓
9. 나중에 오답노트에서 [재풀이] 클릭 시:
   - IncorrectNoteService.getPracticeSession()이 가상 시험지(quizSetId: -1L) 생성
   - CBTPlayer가 다시 열리며 오답들만 모아 집중 재시험 시작!
```

---

## 4. 실제 코드 위치

**Backend:**
- `backend/.../controller/QuizController.java` — `POST /api/quiz/attempts` (풀이 답안 제출 및 채점 요청)
- `backend/.../service/QuizService.java` — `saveAttempt()` (서버 주도 채점, 답안 정규화, 가상 세션 소유권 검증)
- `backend/.../controller/IncorrectNoteController.java` — 오답노트 그룹 생성, 문항 추가, 오답 재풀이 세션 요청
- `backend/.../service/IncorrectNoteService.java` — `addToGroup()`, `getPracticeSession()` (오답들로 가상 `quizSetId: -1L` 시험지 조립)
- `backend/.../domain/QuizAttempt.java` — 시험 응시 기록 엔티티 (`score`, `status`, `student`)
- `backend/.../domain/UserAnswer.java` — 문항별 제출 답안 및 정답 여부 엔티티 (`isCorrect`, `submittedAnswer`)
- `backend/.../domain/IncorrectNoteGroup.java`, `IncorrectNoteItem.java` — 오답노트 그룹 및 매핑 엔티티

**Frontend:**
- `frontend/src/components/editor/components/CBTPlayer.jsx` — 1문항 CBT 플레이어, 실시간 풀이 상태 관리, 서버 채점 요청, 결과 리포트 화면
- `frontend/src/components/editor/components/IncorrectNoteModal.jsx` — 틀린 문제를 기존 그룹에 추가하거나 새 그룹을 만들어 스크랩하는 모달
- `frontend/src/components/editor/hooks/useSourceBlockScroll.js` — 출처 보기 클릭 시 해당 블록 ID로 부드럽게 스크롤 이동(`scrollIntoView`)

**Database:**
- `quiz_attempts`: 응시 ID, 퀴즈 세트 ID, 학생 ID, 점수, 소요시간
- `user_answers`: 답안 ID, 응시 ID, 문제 ID, 제출한 답안, 정답 여부(`is_correct`)
- `incorrect_note_groups`, `incorrect_note_items`: 오답노트 폴더 및 문항 매핑 테이블

---

## 5. 코드가 실제로 어떻게 실행되는가?

### 🔵 STEP 1. CBTPlayer 인터페이스와 문제 탐색 상태 관리

`CBTPlayer.jsx`:

```jsx
const CBTPlayer = ({ quizData, onClose, courseId, mode = 'solve', initialAnswers = null }) => {
  const [currentIdx, setCurrentIdx] = useState(0); // 현재 풀고 있는 문제 번호 (0부터 시작)
  const [answers, setAnswers] = useState(initialAnswers || {}); // { 0: "A", 1: "true", 2: "운영체제" }
  const [submitted, setSubmitted] = useState(mode === 'report');

  const questions = quizData.questions;
  const currentQuestion = questions[currentIdx];

  // 보기를 클릭했을 때 답안 임시 저장
  const handleSelect = (option) => {
    if (submitted) return; // 이미 제출된 시험이면 수정 불가
    setAnswers({ ...answers, [currentIdx]: option });
  };
```

> 💬 **쉽게 말하면**: 토플이나 정보처리기사 시험 화면처럼, 1번 문제를 풀면 `answers[0]`에 답을 체크해두고 [다음] 버튼을 눌러 2번, 3번 문제로 넘어가는 전형적인 CBT 상태 관리입니다.

---

### 🔵 STEP 2. 보안 채점: 점수를 신뢰하지 않는 서버 주도 채점 (`handleSubmit`)

클라이언트에서 아무리 100점이라고 계산했더라도, 백엔드에는 **오직 학생이 제출한 원본 답안 텍스트**만 보냅니다.

`CBTPlayer.jsx`:

```javascript
const handleSubmit = async () => {
  if (isSaving) return;
  setIsSaving(true);

  try {
    // 🔒 점수(score)는 보내지 않고, 오직 { 문제ID, 제출한 답 }만 전송한다!
    const userAnswers = questions.map((q, idx) => ({
      questionId: q.questionId,
      submittedAnswer: String(answers[idx] || '')
    }));

    await client.post('/quiz/attempts', {
      quizSetId: quizData.quizSetId,
      userAnswers: userAnswers
    });

    setSubmitted(true); // 채점 완료 화면으로 전환
  } finally {
    setIsSaving(false);
  }
};
```

`QuizService.java`:

```java
@Transactional
public void saveAttempt(QuizAttemptRequest request, Student student) {
    ...
    List<UserAnswer> gradedAnswers = new ArrayList<>();
    int correctCount = 0;

    for (QuizAttemptRequest.UserAnswerRequest uar : request.getUserAnswers()) {
        Question question = questionRepository.findById(uar.getQuestionId())
            .orElseThrow(() -> new ResourceNotFoundException("문제를 찾을 수 없습니다."));

        // 🔒 서버가 직접 정답과 대조하여 정답 여부를 판정한다!
        boolean isCorrect = isAnswerCorrect(uar.getSubmittedAnswer(), question.getCorrectAnswer());
        if (isCorrect) {
            correctCount++; // 정답 카운트 증가
        }

        UserAnswer userAnswer = new UserAnswer();
        userAnswer.setQuestion(question);
        userAnswer.setSubmittedAnswer(uar.getSubmittedAnswer());
        userAnswer.setIsCorrect(isCorrect);
        gradedAnswers.add(userAnswer);
    }

    // 서버가 계산한 공인 점수를 QuizAttempt에 저장
    QuizAttempt attempt = new QuizAttempt();
    attempt.setQuizSet(quizSet);
    attempt.setStudent(student);
    attempt.setScore(correctCount); // 서버가 직접 계산한 점수!
    quizAttemptRepository.save(attempt);
    ...
}
```

> 💬 **쉽게 말하면**: 학생이 시험지에 "나 100점이에요"라고 써서 내는 걸 믿는 선생님은 없습니다. 시험지(OMR 카드)만 걷어서 **선생님(서버)이 직접 채점기를 돌려 점수를 매기는 원리**입니다.

---

### 🔵 STEP 3. 답안 정규화 및 공백/대소문자 무시 판정

학생이 "CPU"라고 쓰든, " cpu "라고 공백을 넣어서 쓰든 모두 정답으로 인정해 주어야 합니다.

`QuizService.java`:

```java
private boolean isAnswerCorrect(String submittedAnswer, String correctAnswer) {
    if (submittedAnswer == null || correctAnswer == null) return false;
    // 1. 앞뒤 공백 제거(trim)
    // 2. 대소문자 무시(toLowerCase)
    return submittedAnswer.trim().equalsIgnoreCase(correctAnswer.trim());
}
```

> 💬 **쉽게 말하면**: 단답형 퀴즈에서 띄어쓰기 한 칸이나 대소문자 차이로 억울하게 틀리는 일이 없도록, 서버가 앞뒤 군더더기를 싹 정리하고 비교합니다.

---

### 🔵 STEP 4. 가상 세션(`quizSetId: -1L`)과 오답 재풀이 지원

오답노트에 담긴 문제들은 1번 시험지, 2번 시험지, 3번 시험지에서 틀린 문제들이 짬뽕으로 섞여 있습니다.  
그렇다면 특정 `quizSetId` 하나에 종속될 수 없는데, 서버는 이를 어떻게 처리할까요?

`QuizService.java`:

```java
Long requestedQuizSetId = request.getQuizSetId();
// quizSetId가 null이거나 -1이면 "오답노트 재풀이" 가상 세션으로 판정!
boolean isVirtualSession = requestedQuizSetId == null || requestedQuizSetId < 0;

QuizSet quizSet = null;
if (!isVirtualSession) {
    quizSet = quizSetRepository.findById(requestedQuizSetId)...;
} else {
    // 가상 세션은 단일 quizSet이 없으므로 '문제 단위'로 소유권을 철저히 검증!
    validateOwnership(question.getQuizSet().getStudent(), student, "본인 문제만 풀이할 수 있습니다.");
}
```

`IncorrectNoteService.java`:

```java
@Transactional(readOnly = true)
public QuizSetDetailResponse getPracticeSession(Long groupId, Student student) {
    IncorrectNoteGroup group = groupRepository.findById(groupId)...;

    List<QuestionResponse> questions = group.getItems().stream()
        .map(item -> questionResponseMapper.toResponse(item.getQuestion()))
        .collect(Collectors.toList());

    return QuizSetDetailResponse.builder()
        .quizSetId(-1L) // ⭐ 가상 시험지 ID (-1L) 부여!
        .title(group.getTitle() + " (오답 복습)")
        .difficulty(QuizDifficulty.NORMAL)
        .questions(questions)
        .build();
}
```

> 💬 **쉽게 말하면**: "이 문제들은 여러 시험지에서 찢어서 스크랩한 오답 모음집이니까, 가상 시험지 번호인 `-1번`을 붙여서 채점해줘!"라고 유연하게 처리하는 아키텍처입니다.

---

### 🔵 STEP 5. 출처 문단 점프: "내가 왜 틀렸지? 원본 필기로 이동!"

결과 화면에서 [출처 보기] 버튼을 누르면, 8강에서 AI가 기록해 둔 `sourceBlockId`를 찾아 노트 에디터로 워프합니다.

`CBTPlayer.jsx`:

```javascript
const handleViewSource = (q) => {
  if (!q.sourceNoteId || !q.sourceBlockId) {
    alert('출처 정보를 찾을 수 없습니다.');
    return;
  }
  // React Router navigate를 통해 해당 노트로 이동하면서 state에 blockId를 전달!
  navigate(`/course/${courseId}/note/${q.sourceNoteId}`, { 
    state: { scrollToBlockId: q.sourceBlockId } 
  });
  onClose();
};
```

`useSourceBlockScroll.js`:

```javascript
// 노트 상세 페이지가 열릴 때 scrollToBlockId가 있으면 해당 문단으로 부드럽게 스크롤!
const element = document.querySelector(`[data-id="${scrollToBlockId}"]`);
if (element) {
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // 노란색 하이라이트 깜빡임 애니메이션 효과 적용
  element.classList.add('highlight-pulse');
}
```

> 💬 **쉽게 말하면**: 문제를 틀렸을 때 [출처 보기]를 누르면, 그 내용이 적혀 있던 강의 노트가 짠 하고 열리면서 해당 문단으로 화면이 스르륵 스크롤되고 노란색으로 반짝여서 복습을 완벽하게 도와줍니다.

---

### 🔵 STEP 6. 오답노트 스크랩 (`IncorrectNoteModal.jsx`)

`IncorrectNoteService.java`:

```java
@Transactional
public void addToGroup(AddToIncorrectRequest request, Student student) {
    IncorrectNoteGroup group;
    // 기존 그룹에 넣거나, "중간고사 벼락치기"처럼 새 그룹명을 적으면 자동 생성!
    if (request.getGroupId() != null) {
        group = groupRepository.findById(request.getGroupId())...;
    } else {
        group = groupRepository.save(new IncorrectNoteGroup(student, request.getNewGroupTitle()));
    }

    // 중복 추가 방지 (이미 담긴 문제면 무시)
    if (itemRepository.findByGroup_IdAndQuestion_QuestionId(group.getId(), questionId).isEmpty()) {
        IncorrectNoteItem item = new IncorrectNoteItem(group, question);
        itemRepository.save(item);
    }
}
```

> 💬 **쉽게 말하면**: 틀린 문제를 클릭 한 번으로 "운영체제 약점 모음" 폴더에 저장해두고, 시험 전날 그 폴더만 열어서 10분 만에 싹 훑어볼 수 있게 해줍니다.

---

## 6. 데이터가 어떻게 이동하는가?

```
[학생: CBT 시험 완료 후 "답안 제출"]
       ↓
[CBTPlayer: handleSubmit()]
   POST /api/quiz/attempts
   Body: { quizSetId: 101, userAnswers: [{ questionId: 501, submittedAnswer: "페이징" }, ...] }
       ↓
[QuizController] ── Principal 학번 확인
       ↓
[QuizService.saveAttempt()]
   ├── 1. questionId 501 조회 (correctAnswer: "페이징 기법")
   ├── 2. isAnswerCorrect("페이징", "페이징 기법") → false 채점
   ├── 3. INSERT INTO quiz_attempts (score: 1, ...) → attemptId: 88 발급
   └── 4. INSERT INTO user_answers (attempt_id: 88, is_correct: false, ...)
       ↓ 200 OK
[CBTPlayer 결과 화면]
   - 1 / 2 점 표시
   - 501번 문제 [출처 보기] 클릭!
       ↓
   navigate('/course/1/note/10', { state: { scrollToBlockId: 'b1' } })
       ↓
[NotionEditor & useSourceBlockScroll]
   document.querySelector('[data-id="b1"]').scrollIntoView() → 해당 필기 문단으로 워프!
```

---

## 7. 왜 이렇게 설계했는가?

1. **왜 채점을 100% 서버에서 수행하는가?**
   - 클라이언트 사이드 채점은 브라우저 메모리 조작, 네트워크 인터셉트, 스크립트 변조에 취약합니다.
   - 서버가 `questionRepository`의 원본 정답과 대조하여 `score`를 직접 산출해야만 공정성과 데이터 무결성이 보장됩니다.

2. **왜 가상 세션에 `-1L` 관례를 사용하는가?**
   - 정규 퀴즈는 `QuizSet` 외래키를 갖지만, 오답노트 복습이나 스마트 추천 큐(10강)는 여러 퀴즈에서 문제를 뽑아 만든 **동적 시험지**입니다.
   - 이를 위해 DB에 임시 `QuizSet` 레코드를 매번 INSERT했다가 DELETE하는 것은 심각한 DB 낭비입니다. 따라서 `quizSetId: -1L`을 가상 플래그로 두고 `QuizAttempt.quizSet`을 nullable로 설계하여 불필요한 쓰기 비용을 없앴습니다.

3. **왜 `isAnswerCorrect`에서 공백 및 대소문자를 정규화하는가?**
   - 모바일 키보드나 한글 입력기 특성상 단어 뒤에 무심코 띄어쓰기(Space)가 붙거나 대소문자가 틀리는 경우가 빈번합니다.
   - `trim().equalsIgnoreCase()` 정규화를 거쳐 사소한 입력 습관으로 인한 채점 불이익을 방지했습니다.

---

## 8. 초보자가 헷갈리기 쉬운 부분

| 헷갈리는 것 | 실제 동작 |
|---|---|
| `QuizAttempt`와 `UserAnswer`의 관계 | `QuizAttempt`는 **시험지 1회 응시 표지(총점, 응시일시)**이고, `UserAnswer`는 그 시험지에 속한 **개별 문항마다 학생이 쓴 답안과 정답 여부(1:N 관계)**입니다. |
| 결과 화면의 점수는 프론트가 계산한 건가요? | 채점 결과는 서버 DB에 저장되며, 리포트 화면(`mode === 'report'`)은 서버의 `QuizAttempt.score`를 그대로 조회해 렌더링합니다. |
| 출처 이동 시 다른 강의 노트로도 갈 수 있나요? | 갈 수 없습니다. 8강에서 퀴즈를 생성할 때 해당 강의(`courseId`)에 속한 노트들만 묶었으므로, 현재 수강 중인 강의 내의 안전한 노트 경로로만 이동합니다. |

---

## 9. 시험/면접에서 알아야 할 핵심

> **"CBT 퀴즈 채점 시스템을 개발할 때 데이터 위변조 방지(치팅 방지)와 오답노트 재풀이 아키텍처를 어떻게 설계했나요?"**

✅ 이렇게 설명할 수 있습니다:
> "첫째, **채점 무결성**을 위해 클라이언트가 계산한 점수를 일체 신뢰하지 않고 오직 `{ questionId, submittedAnswer }` 페이로드만 서버로 전달했습니다. 서버의 `saveAttempt()` 트랜잭션 내부에서 DB 원본 정답과 대조하여 점수(`score`)와 정답 여부(`isCorrect`)를 직접 연산하여 `QuizAttempt` 및 `UserAnswer` 엔티티로 영속화했습니다.  
> 둘째, **오답노트 재풀이**의 경우 서로 다른 시험지에서 추출된 문제들이 섞여 있으므로, 불필요한 임시 `QuizSet`을 생성하지 않고 **가상 세션 ID(`-1L`)**를 부여하는 아키텍처를 구현했습니다. 서버는 `-1L` 세션에 대해 단일 퀴즈 소유권 대신 개별 문제 소유권을 검증하고 `QuizAttempt`의 quizSet 참조를 null 허용으로 유연하게 처리함으로써 DB I/O를 최적화했습니다."

---

## 10. 이해 확인 문제 📝

**Q1. (쉬운 문제)**  
학생이 CBT 풀이를 마치고 답안을 제출할 때 호출되는 백엔드 API 엔드포인트는 무엇인가요?

**Q2. (흐름 문제)**  
학생이 결과 리포트 화면에서 [출처 보기] 버튼을 클릭했을 때, 원본 강의 노트의 해당 문단이 찾아져 화면 중앙에 표시되기까지의 프론트엔드 라우팅 및 스크롤 과정을 설명해 보세요.

**Q3. (코드 이해)**  
`QuizService.java`에서 `isVirtualSession = requestedQuizSetId == null || requestedQuizSetId < 0` 조건이 필요한 이유는 무엇인가요?

**Q4. (설계 이해)**  
클라이언트(`CBTPlayer.jsx`)가 계산한 `calculateScore()` 결과값을 `POST /api/quiz/attempts` 요청 본문에 포함시키지 않고 서버가 직접 다시 채점하는 보안상의 이유는 무엇인가요?

**Q5. (면접형)**  
오답노트(`IncorrectNoteGroup`)에서 서로 다른 퀴즈 세트의 문제들을 묶어서 재풀이할 수 있도록 백엔드 도메인과 서비스를 설계할 때 고려해야 할 핵심 포인트를 설명해 보세요.
