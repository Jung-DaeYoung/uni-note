# 🎓 UniNote 코드 과외 — 8강: AI 기반 퀴즈 자동 생성 파이프라인

---

## 1. 이 기능이 무엇인가?

학생이 강의실에서 필기한 노트(텍스트, 도표 이미지, 강의자료 PDF)를 바탕으로, **Google Gemini 생성형 AI가 단 5초 만에 객관식·단답형·OX 퀴즈를 자동으로 출제해 주는 기능**입니다.  
단순히 문제를 내는 것에 그치지 않고, 5강에서 배웠던 `BlockId`를 활용해 **"이 문제는 노트의 몇 번째 문단(블록)에서 출제되었다"는 출처 메타데이터(`sourceBlockId`)까지 정밀하게 태깅**하여 저장합니다.

---

## 2. 왜 필요한가?

1. **능동적 회상(Active Recall) 학습**: 교육 심리학적으로 눈으로 노트를 10번 읽는 것보다, 시험 문제를 1번 푸는 것이 뇌에 훨씬 강력한 장기 기억을 남깁니다.
2. **출제 시간의 획기적 절약**: 학생이 스스로 문제를 만드는 것은 시간이 너무 오래 걸립니다. AI가 내가 필기한 핵심 개념을 꿰뚫어 문제를 만들어주면 즉각적인 자기 주도 테스트가 가능해집니다.
3. **환각(Hallucination) 방지 & 근거 추적**: AI는 종종 그럴듯한 거짓말을 지어냅니다. UniNote는 **학생이 직접 작성한 노트 본문과 첨부자료만을 근거로 출제**하도록 엄격히 통제하고, 틀렸을 때 원본 문단으로 즉시 이동할 수 있는 근거를 제공해야 합니다.

---

## 3. 전체 동작 흐름

```
1. 학생이 에디터 상단 "AI 문제 생성" 버튼 클릭
  ↓
2. QuizConfigModal.jsx 팝업 렌더링:
   - 출제할 노트 선택 (부모 노트 선택 시 자식 노드 자동 일괄 선택)
   - 문제 유형별 문항 수 설정 (객관식 2개, OX 2개, 단답형 1개 등)
   - 난이도 선택 (EASY / NORMAL / HARD)
  ↓
3. POST /api/quiz/generate 호출 (client.js)
  ↓
4. QuizController → QuizService.generateQuiz() 수신:
   - 학생의 노트 소유권 검증 (validateNoteAccess)
   - 요청 상한선 검증 (최대 20개 노트, 총 문항 수 최대 30개로 API 폭주 방지)
  ↓
5. QuizAiGenerationService.generateQuizContent() 실행:
   - Tiptap JSON을 순회하며 문단마다 [[REF:noteId/blockId]] 출처 태그 삽입
   - 본문에 첨부된 이미지/PDF의 보안 서명 검증 후 멀티모달 Base64 데이터로 변환
   - Google Gemini 2.5 Flash API 호출 (Structured Outputs: JSON Schema 강제)
  ↓
6. AI 응답 수신 및 안전한 파싱:
   - 마크다운이나 잡담 없이 순수 JSON 객체 추출
  ↓
7. DB 트랜잭션 저장:
   - QuizSet 엔티티 저장 (시험지 제목, 난이도, 소속 강의, 출처 노트 목록)
   - Question 엔티티들 저장 (문항 내용, 보기 리스트, 정답, 해설, sourceNoteId, sourceBlockId)
  ↓
8. 생성된 퀴즈 DTO 반환 → CourseDetailPage에서 즉시 CBTPlayer(9강) 모달 구동!
```

---

## 4. 실제 코드 위치

**Backend:**
- `backend/.../controller/QuizController.java` — `POST /api/quiz/generate` 요청 수신
- `backend/.../service/QuizService.java` — 노트 접근 권한 검증, 요청 상한선 통제, `QuizSet`/`Question` DB 영속화
- `backend/.../service/QuizAiGenerationService.java` — Tiptap JSON 텍스트/미디어 파싱, `[[REF:...]]` 태깅, Gemini REST API 통신 및 Structured Outputs 스키마 정의
- `backend/.../domain/QuizSet.java` — 퀴즈 시험지 세트 엔티티
- `backend/.../domain/Question.java` — 개별 문제 엔티티 (`sourceNoteId`, `sourceBlockId` 외래 식별자 포함)
- `backend/.../dto/QuizRequest.java`, `QuizResponse.java` — 퀴즈 생성 입출력 DTO

**Frontend:**
- `frontend/src/components/editor/components/QuizConfigModal.jsx` — 노트 트리 다중 선택 체크박스, 문항 수 슬라이더, AI 생성 로딩 모달
- `frontend/src/pages/CourseDetailPage.jsx` — 퀴즈 생성 완료 후 CBT 풀이 화면(`CBTPlayer`)으로 전환

---

## 5. 코드가 실제로 어떻게 실행되는가?

### 🔵 STEP 1. 모달에서 출제 범위 설정 및 계층 트리 하위 일괄 선택

사용자가 대단원 노트를 체크하면 그 밑에 딸린 소단원 자식 노트들도 한 번에 묶여서 출제 범위로 지정됩니다.

`QuizConfigModal.jsx`:

```javascript
const toggleNote = (noteId) => {
  // 재귀적으로 해당 노드와 모든 자식 노드의 ID를 수집
  const getAllChildIds = (nodes, id) => {
    for (const node of nodes) {
      if (node.noteId === id) {
        const ids = [node.noteId];
        const collectChildren = (children) => {
          if (!children) return;
          children.forEach(child => {
            ids.push(child.noteId);
            collectChildren(child.children);
          });
        };
        collectChildren(node.children);
        return ids;
      }
      if (node.children) {
        const found = getAllChildIds(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const targetIds = getAllChildIds(noteTree, noteId) || [noteId];
  const isSelecting = !selectedIds.includes(noteId);
  ...
};
```

> 💬 **쉽게 말하면**: "1주차 컴퓨터구조" 폴더를 체크하면 그 밑에 있는 "1교시 레지스터", "2교시 ALU" 필기까지 쏙쏙 골라서 AI에게 한 번에 건네줄 수 있도록 만들어 둔 똑똑한 트리 탐색 코드입니다.

---

### 🔵 STEP 2. 백엔드 상한선 제약 — LLM API 과소비 및 DDoS 방어

`QuizService.java`:

```java
private static final int MAX_NOTES_PER_QUIZ = 20;     // 최대 노트 20개
private static final int MAX_QUESTIONS_PER_TYPE = 20; // 유형당 최대 20문제
private static final int MAX_TOTAL_QUESTIONS = 30;    // 한 번에 최대 30문제

private void validateGenerationLimits(QuizRequest request, List<Note> notes) {
    if (notes.size() > MAX_NOTES_PER_QUIZ) {
        throw new InvalidRequestException("한 번에 최대 " + MAX_NOTES_PER_QUIZ + "개의 노트까지 사용할 수 있습니다.");
    }

    int total = 0;
    for (Integer count : request.getTypeCounts().values()) {
        if (count == null || count < 1 || count > MAX_QUESTIONS_PER_TYPE) {
            throw new InvalidRequestException("문제 유형별 개수는 1~" + MAX_QUESTIONS_PER_TYPE + " 사이여야 합니다.");
        }
        total += count;
    }
    if (total > MAX_TOTAL_QUESTIONS) {
        throw new InvalidRequestException("한 번에 생성할 수 있는 총 문제 수는 최대 " + MAX_TOTAL_QUESTIONS + "개입니다.");
    }
}
```

> 💬 **쉽게 말하면**: "한 번에 1,000문제 만들어줘!"라고 악의적인 요청을 보내서 AI 토큰 비용을 폭탄 맞게 하거나 서버를 마비시키는 시도를 원천 차단합니다.

---

### 🔵 STEP 3. 출처 추적 태그(`[[REF:...]]`) 삽입 및 멀티모달 파싱

AI에게 문장을 보낼 때 그냥 텍스트만 보내지 않고, 5강에서 심어두었던 `BlockId`를 문단 앞에 꼬리표로 달아줍니다.

`QuizAiGenerationService.java`:

```java
private void extractDataFromNode(Long noteId, String currentBlockId, JsonNode node, StringBuilder textBuilder,
                                  List<Map<String, Object>> mediaParts, String studentNum, AtomicLong totalMediaBytes) {
    if (node.isObject()) {
        String type = node.path("type").asText();
        String blockId = node.path("attrs").has("id") ? node.path("attrs").path("id").asText() : currentBlockId;

        if ("text".equals(type)) {
            if (blockId != null) {
                // 문단마다 출처 태그 삽입! 예: [[REF:10/a8b9c1]]
                textBuilder.append("[[REF:").append(noteId).append("/").append(blockId).append("]] ");
            }
            textBuilder.append(node.path("text").asText()).append(" ");
        } else if ("image".equals(type) || "pdfBlock".equals(type)) {
            // 본문 속 이미지/PDF도 6강의 서명 검증을 거쳐 AI 멀티모달 페이로드에 첨부!
            String src = node.path("attrs").path("src").asText();
            addMediaPart(src, mimeType, mediaParts, studentNum, totalMediaBytes);
        }
        ...
```

> 💬 **쉽게 말하면**: 노트 내용을 AI에게 줄 때 `[[REF:10번노트/x9y1문단]] CPU는 연산장치와 제어장치로 구성된다.` 처럼 문장마다 출처 번호표를 붙여서 보냅니다.

---

### 🔵 STEP 4. Gemini Structured Outputs (JSON Schema 강제)

LLM을 연동할 때 가장 골치 아픈 문제는 **"AI가 JSON 대신 마크다운(` ```json `)이나 '안녕하세요! 요청하신 문제입니다' 같은 사족을 붙여 파싱 에러를 내는 것"**입니다.  
UniNote는 Google Gemini의 **Structured Outputs (`responseSchema`)** 기능을 사용해 100% 순수 JSON만 나오도록 물리적으로 강제합니다.

`QuizAiGenerationService.java`:

```java
// Gemini에게 반환해야 할 정확한 데이터 구조를 JSON Schema로 선언!
Map<String, Object> schema = Map.of(
    "type", "OBJECT",
    "properties", Map.of(
        "title", Map.of("type", "STRING"),
        "difficulty", Map.of("type", "STRING"),
        "questions", Map.of(
            "type", "ARRAY",
            "items", Map.of(
                "type", "OBJECT",
                "properties", Map.of(
                    "type", Map.of("type", "STRING"),
                    "questionText", Map.of("type", "STRING"),
                    "options", Map.of("type", "ARRAY", "items", Map.of("type", "STRING")),
                    "correctAnswer", Map.of("type", "STRING"),
                    "explanation", Map.of("type", "STRING"),
                    "sourceNoteId", Map.of("type", "NUMBER"),
                    "sourceBlockId", Map.of("type", "STRING")
                ),
                "required", List.of("type", "questionText", "correctAnswer")
            )
        )
    ),
    "required", List.of("title", "difficulty", "questions")
);

Map<String, Object> requestBody = Map.of(
    "contents", List.of(Map.of("parts", parts)),
    "generationConfig", Map.of(
        "responseMimeType", "application/json", // MIME 타입을 JSON으로 강제
        "responseSchema", schema               // 위에서 정의한 스키마 강제
    )
);
```

> 💬 **쉽게 말하면**: AI에게 "말대꾸하지 말고 이 양식(Schema) 빈칸만 딱 채워서 컴퓨터가 읽을 수 있는 순수 JSON으로만 제출해!"라고 강력한 족쇄를 채우는 설정입니다.

---

### 🔵 STEP 5. 생성된 퀴즈 DB 저장 (`QuizSet` & `Question`)

`QuizService.java`:

```java
@Transactional
public QuizResponse generateQuiz(QuizRequest request, Student student) {
    ...
    QuizResponse quizResponse = quizAiGenerationService.generateQuizContent(request, notes, student);

    // 1. 시험지 세트 헤더 저장
    QuizSet quizSet = new QuizSet();
    quizSet.setTitle(quizResponse.getTitle());
    quizSet.setDifficulty(request.getDifficulty());
    quizSet.setSourceNotes(writeJson(request.getNoteIds())); // [10, 11] JSON 배열
    quizSet.setStudent(student);
    quizSet.setCourse(notes.get(0).getCourse());
    quizSetRepository.save(quizSet);

    // 2. 개별 문제들 저장 (출처 메타데이터 포함!)
    for (QuestionResponse qr : quizResponse.getQuestions()) {
        Question question = new Question();
        question.setQuizSet(quizSet);
        question.setType(qr.getType()); // MULTIPLE_CHOICE, OX, SHORT_ANSWER
        question.setQuestionText(qr.getQuestionText());
        question.setOptions(writeJson(qr.getOptions())); // 객관식 4지선다 보기
        question.setCorrectAnswer(qr.getCorrectAnswer());
        question.setExplanation(qr.getExplanation());
        
        // ⭐ 출처 추적 필드 영속화!
        question.setSourceNoteId(qr.getSourceNoteId());
        question.setSourceBlockId(qr.getSourceBlockId());

        Question savedQuestion = questionRepository.save(question);
        qr.setQuestionId(savedQuestion.getQuestionId());
        quizSet.getQuestions().add(savedQuestion);
    }
    quizResponse.setQuizSetId(quizSet.getQuizSetId());
    return quizResponse;
}
```

> 💬 **쉽게 말하면**: AI가 가져온 문제 보따리를 풀어서, 큰 시험지 껍데기(`QuizSet`)를 DB에 등록하고, 그 안에 1번~N번 문제(`Question`)들을 정답, 해설, 출처 블록 ID까지 빠짐없이 MySQL 테이블에 착착 정리해서 넣습니다.

---

## 6. 데이터가 어떻게 이동하는가?

```
[클라이언트: QuizConfigModal]
   POST /api/quiz/generate
   Body: { noteIds: [10], typeCounts: { MULTIPLE_CHOICE: 2, OX: 1 }, difficulty: "NORMAL" }
         ↓
[QuizController] ── Principal 학번 확인
         ↓
[QuizService] ── validateNoteAccess() & validateGenerationLimits() 통과
         ↓
[QuizAiGenerationService]
   ├── 1. Note 10번 content(Tiptap JSON) 파싱
   │      "[[REF:10/b1]] 가상 메모리는..."
   ├── 2. 본문 속 첨부 이미지 바이너리 인라인 인코딩
   └── 3. Gemini 2.5 Flash API 호출 (POST https://generativelanguage.../generateContent)
            - Prompt + Schema (application/json)
         ↓
[Google Gemini AI]
   JSON 응답:
   {
     "title": "가상 메모리 핵심 퀴즈",
     "questions": [
       {
         "type": "MULTIPLE_CHOICE",
         "questionText": "가상 메모리 페이징 기법의 설명으로 옳은 것은?",
         "options": ["A", "B", "C", "D"],
         "correctAnswer": "A",
         "explanation": "페이징 기법은 고정 크기 블록으로 나눕니다.",
         "sourceNoteId": 10,
         "sourceBlockId": "b1"
       }
     ]
   }
         ↓
[QuizService DB 영속화]
   - INSERT INTO quiz_sets ... (quiz_set_id: 101)
   - INSERT INTO questions (quiz_set_id, source_note_id, source_block_id, ...) VALUES (101, 10, 'b1', ...)
         ↓
[200 OK 응답: QuizResponse]
         ↓
[CourseDetailPage] → CBTPlayer(9강) 모달 즉시 실행!
```

---

## 7. 왜 이렇게 설계했는가?

1. **왜 Gemini의 Structured Outputs (`responseSchema`)를 도입했는가?**
   - 기존 프롬프트 방식("반드시 JSON으로 답해줘")은 AI가 종종 `Here is the JSON:` 같은 설명 문구를 앞에 붙여서 `JSON.parse` 에러가 빈번했습니다.
   - API 레벨에서 Schema를 강제하면 문법 오류나 필드 누락이 0%가 되어 서비스 신뢰성이 극대화됩니다.

2. **왜 프롬프트에 `[[REF:noteId/blockId]]` 태그를 심었는가?**
   - AI에게 "너가 상상해서 내지 말고, 본문에 표시된 태그 번호를 보고 그 문단에서만 문제를 내라"고 강제함으로써 **환각(Hallucination) 현상을 원천 차단**합니다.
   - 또한 이 메타데이터 덕분에 학생이 오답노트를 볼 때 해당 노트의 해당 문단으로 정확히 점프(`scrollIntoView`)할 수 있습니다.

3. **왜 첨부 파일도 `FileAccessSigner.isValid` 검사를 거치는가?**
   - 만약 노트 JSON을 악의적으로 조작하여 다른 학생의 비공개 이미지나 기밀 PDF URL을 몰래 넣어두면, AI 퀴즈 생성기가 그 파일을 읽어서 문제로 유출시킬 위험(간접 데이터 탈취 공격)이 있습니다.
   - 따라서 AI에게 넘길 때도 본인 소유의 유효한 서명인지 확인하여 타인의 자료가 프롬프트에 섞이지 못하게 차단했습니다.

---

## 8. 초보자가 헷갈리기 쉬운 부분

| 헷갈리는 것 | 실제 동작 |
|---|---|
| AI가 문제를 만들 때 인터넷 검색도 하나요? | **하지 않습니다.** 학생이 선택한 노트 텍스트와 첨부자료만을 프롬프트 컨텍스트로 제공하여 출제하므로, 해당 강의 범위 밖의 엉뚱한 문제가 나오지 않습니다 (RAG/Grounded 방식). |
| `QuizSet`과 `QuizAttempt`는 어떻게 다른가요? | `QuizSet`은 AI가 만들어 둔 **시험지 원본(문제 세트)**이고, `QuizAttempt`는 학생이 그 시험지를 **실제로 몇 점으로 풀었는지 기록하는 풀이 채점표(9강)**입니다. 하나의 시험지를 여러 번 다시 풀 수 있습니다. |
| 보기(`options`)는 DB 테이블이 따로 없나요? | UniNote에서는 4지선다 보기를 복잡한 테이블 매핑 대신 JSON 문자열(`["A", "B", "C", "D"]`)로 직렬화하여 `questions` 테이블의 컬럼에 깔끔하게 보관합니다. |

---

## 9. 시험/면접에서 알아야 할 핵심

> **"LLM(생성형 AI)을 실제 서비스에 연동할 때 겪었던 문제점과, UniNote에서 신뢰성을 확보한 방식을 설명해 보세요."**

✅ 이렇게 설명할 수 있습니다:
> "LLM 연동 시 가장 큰 두 가지 문제는 **출력 형식의 불안정성(파싱 에러)**과 **환각(Hallucination)**입니다.  
> UniNote에서는 첫째, Google Gemini의 **Structured Outputs (`responseSchema`)** 설정을 적용해 응답 MIME 타입을 `application/json`으로 고정하고 DTO 스키마를 강제하여 파싱 실패율을 0%로 만들었습니다.  
> 둘째, 환각을 억제하기 위해 에디터의 커스텀 블록 식별자인 `BlockId`를 활용해 본문 문단마다 `[[REF:noteId/blockId]]` 태그를 삽입하고, AI에게 해당 블록만을 근거로 문제를 출제하도록 지시했습니다.  
> 이를 통해 문제의 출처 블록 ID를 DB에 영속화할 수 있었고, 향후 오답노트에서 클릭 시 원본 필기 문단으로 즉시 이동하는 '근거 중심 복습 파이프라인'을 성공적으로 구축했습니다."

---

## 10. 이해 확인 문제 📝

**Q1. (쉬운 문제)**  
AI가 생성한 퀴즈 문제가 노트의 어느 문단에서 출제되었는지 추적하기 위해 `Question` 엔티티에 저장되는 2가지 메타데이터 필드명은 무엇인가요?

**Q2. (흐름 문제)**  
학생이 `QuizConfigModal`에서 대단원 노트를 선택했을 때, 하위 자식 노트들까지 한꺼번에 선택되도록 도와주는 프론트엔드의 알고리즘 함수명은 무엇인가요?

**Q3. (코드 이해)**  
`QuizAiGenerationService.java`에서 Gemini API 요청 시 `generationConfig`에 `responseSchema`를 등록하는 목적은 무엇인가요?

**Q4. (설계 이해)**  
`QuizService.java`에서 `validateGenerationLimits` 메서드를 두어 총 문제 수를 최대 30개로 제한한 이유는 무엇인가요?

**Q5. (면접형)**  
AI가 생성한 퀴즈의 신뢰도를 높이고 환각(Hallucination)을 방지하기 위해 UniNote가 프롬프트 구성 단계에서 취한 핵심 전략을 설명해 보세요.
