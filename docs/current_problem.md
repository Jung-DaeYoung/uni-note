# AI 문제 생성 학습 목표 미반영 문제

## 1. 문제 요약

AI 문제 생성 패널에서 학습 목표를 입력해도 생성된 문제가 해당 목표를 충분히 평가하지 않는다.

현재 백엔드는 학습 목표를 Gemini 프롬프트에 참고사항으로 전달할 뿐이며, Gemini 응답에 목표와 문항의 연결 정보를 요구하지 않는다. 또한 생성 결과가 학습 목표를 실제로 반영했는지 검증하지 않고 저장한다.

따라서 현재 기능은 엄밀한 의미의 **학습 목표 기반 문제 생성**이 아니라 **학습 목표를 참고로 제공하는 문제 생성**에 가깝다.

## 2. 관련 코드

- 프롬프트 생성: `backend/src/main/java/com/uninote/backend/service/QuizAiGenerationService.java`
- 요청 DTO: `backend/src/main/java/com/uninote/backend/dto/QuizRequest.java`
- Gemini 호출: `backend/src/main/java/com/uninote/backend/service/GeminiClient.java`
- 응답 DTO:
  - `backend/src/main/java/com/uninote/backend/dto/QuizResponse.java`
  - `backend/src/main/java/com/uninote/backend/dto/QuestionResponse.java`
- 생성 결과 검증: `backend/src/main/java/com/uninote/backend/service/QuizQualityValidator.java`

## 3. Gemini에 전달하는 현재 프롬프트

학습 목표가 있으면 다음 지시가 기본 문제 생성 프롬프트 중간에 삽입된다.

```text
학습 목표:
- {목표 1}
- {목표 2}

가능한 한 각 문항이 위 학습 목표 중 하나를 평가하도록 출제하라.
단, 노트에 근거가 없는 목표는 건너뛰고 내용을 지어내지 마라.
```

프롬프트 전체 흐름은 다음과 같다.

```text
강의 내용(텍스트, 이미지, PDF)을 기반으로 퀴즈를 생성하라.
텍스트 내용에는 [[REF:noteId/blockId]] 형태의 출처 메타데이터가 포함되어 있다.
모든 문항은 제공된 출처 중 하나를 근거로 생성해야 한다.
난이도: {난이도}. 문항은 {난이도 기준}으로 출제하라.
유형별 문제 수 배분: {유형별 문항 수}.
{학습 목표 지시}
{집중 개념 지시}
{오답 문제 재출제 지시}
{노트별 출제 지시}
응답 구조: {JSON 구조}
엄격 준수 사항: ...
텍스트 내용: {노트 내용}
```

## 4. 현재 Gemini 응답 구조

Gemini에는 다음 형태의 JSON Schema가 전달된다.

```json
{
  "title": "제목",
  "difficulty": "NORMAL",
  "questions": [
    {
      "type": "MULTIPLE_CHOICE",
      "questionText": "내용",
      "options": ["A", "B"],
      "correctAnswer": "정답",
      "explanation": "해설",
      "sourceNoteId": 1,
      "sourceBlockId": "b1",
      "conceptTags": ["개념"]
    }
  ]
}
```

문항별로 요구되는 필드는 다음과 같다.

- `type`
- `questionText`
- `correctAnswer`
- `explanation`
- `conceptTags`
- 출처가 있는 입력이면 `sourceNoteId`, `sourceBlockId`

응답에는 학습 목표 자체나 학습 목표와 문항의 관계를 나타내는 필드가 없다.

예를 들어 다음과 같은 매핑 정보가 요구되지 않는다.

```json
{
  "objectiveIndices": [0]
}
```

또는:

```json
{
  "learningObjectives": ["LRU와 FIFO를 비교할 수 있다"]
}
```

## 5. 핵심 원인

### 5.1 학습 목표 지시가 강제사항이 아님

현재 프롬프트는 다음과 같이 작성되어 있다.

```text
가능한 한 각 문항이 위 학습 목표 중 하나를 평가하도록 출제하라.
```

`가능한 한`이라는 표현은 목표 반영을 선택사항으로 만든다. Gemini는 출처, 문항 수, 난이도, 문제 유형 등의 다른 제약은 지키면서 학습 목표를 생략할 수 있다.

### 5.2 응답에 목표-문항 매핑이 없음

Gemini가 어떤 문항이 어떤 학습 목표를 평가하는지 응답하지 않는다. 따라서 생성 후 다음을 판단할 수 없다.

- 각 문항이 어떤 목표에 대응하는지
- 모든 목표가 최소 한 번씩 다뤄졌는지
- 목표와 무관한 문항이 포함됐는지

### 5.3 서버 검증기가 학습 목표를 검사하지 않음

`QuizQualityValidator`는 다음 항목을 검증한다.

- 문항 존재 여부
- 요청한 유형별 문항 수
- 문제 내용과 정답 존재 여부
- 객관식 보기와 정답 형식
- 세트 내 중복 문제
- 출처 유효성
- 개념 태그 정리

하지만 다음은 검증하지 않는다.

- 학습 목표별 최소 문항 수
- 학습 목표와 문항의 매핑 유효성
- 학습 목표가 하나라도 반영됐는지
- 목표 매핑이 없는 문항의 비율

검증에 통과한 결과는 목표 반영 여부와 무관하게 저장된다.

### 5.4 노트 근거 제한이 목표 반영을 약화시킬 수 있음

프롬프트에는 다음 조건도 있다.

```text
노트에 근거가 없는 목표는 건너뛰고 내용을 지어내지 마라.
```

이 조건은 환각을 막는 데 필요하지만, 목표와 노트 표현이 다르거나 노트에 관련 내용이 부분적으로만 있으면 Gemini가 목표를 건너뛸 수 있다. 현재 서버는 목표가 누락되어도 정상 생성으로 처리한다.

## 6. 재현 예시

학습 목표:

```text
LRU와 FIFO의 차이를 비교할 수 있다
```

현재 요청에는 목표가 프롬프트에 포함되지만, 응답은 다음처럼 목표 연결 없이 반환된다.

```json
{
  "title": "운영체제 퀴즈",
  "difficulty": "NORMAL",
  "questions": [
    {
      "type": "SHORT_ANSWER",
      "questionText": "페이지 폴트란 무엇인가?",
      "correctAnswer": "페이지 폴트",
      "explanation": "필요한 페이지가 메모리에 없을 때 발생한다.",
      "conceptTags": ["페이지 폴트"],
      "sourceNoteId": 1,
      "sourceBlockId": "b1"
    }
  ]
}
```

이 응답은 형식과 출처 검증은 통과할 수 있지만, 입력한 학습 목표인 LRU와 FIFO 비교를 평가하지 않는다.

## 7. 문제의 영향

- 학습자가 입력한 목표와 무관한 문제를 받을 수 있음
- 문제 생성 결과의 예측 가능성이 낮음
- 학습 목표 기능의 사용자 가치가 약화됨
- 목표별 학습 성취도나 커버리지를 추후 분석할 수 없음
- 테스트가 프롬프트에 목표 문자열이 포함되는지만 확인하면 실제 목표 반영 실패를 발견하지 못함

## 8. 필요한 개선 방향

### 8.1 응답에 목표 매핑 필드 추가

학습 목표를 요청 순서의 인덱스로 식별하고, 각 문항에 대응 목표를 포함하도록 한다.

```json
{
  "type": "SHORT_ANSWER",
  "questionText": "LRU와 FIFO의 차이로 옳은 것은?",
  "correctAnswer": "...",
  "explanation": "...",
  "objectiveIndices": [0],
  "conceptTags": ["페이지 교체"],
  "sourceNoteId": 1,
  "sourceBlockId": "b1"
}
```

목표가 여러 개면 `objectiveIndices`에 여러 인덱스를 허용할 수 있다.

### 8.2 프롬프트를 강제형으로 변경

현재의 `가능한 한` 대신 다음 제약을 명시해야 한다.

```text
각 학습 목표는 최소 1개 이상의 문항에서 평가되어야 한다.
각 문항은 반드시 하나 이상의 학습 목표에 대응해야 한다.
각 문항의 objectiveIndices에 실제로 평가하는 목표의 인덱스를 기입하라.
노트에 근거가 없는 목표는 내용을 지어내지 말고 objectiveIndices에서 제외하라.
```

단, 목표 수가 총 문항 수보다 많을 때의 정책은 별도로 정해야 한다.

### 8.3 서버 검증 추가

`QuizQualityValidator`에서 다음을 검증해야 한다.

- `objectiveIndices`가 존재하면 목표 범위 내 인덱스인지 확인
- 각 문항에 최소 하나의 목표 인덱스가 있는지 확인
- 목표별 대응 문항이 있는지 확인
- 목표가 노트 근거 부족으로 제외되는 경우의 허용 정책 적용
- 검증 실패 시 재생성하거나 명확한 생성 실패 응답 반환

### 8.4 목표 수와 문항 수의 정책 정의

현재는 학습 목표 최대 5개, 총 문항 수 최대 30개지만 목표별 최소 문항 수가 정의되어 있지 않다.

다음 중 하나를 명시해야 한다.

- 목표마다 최소 1문항
- 목표별 문항 비율 배분
- 문항 수가 목표 수보다 적으면 일부 목표를 허용
- 목표 수가 문항 수보다 많으면 요청 자체를 거부

## 9. 결론

가장 핵심적인 원인은 다음과 같다.

> 학습 목표를 프롬프트에 참고 지시로만 전달하고, Gemini 응답에 목표-문항 매핑을 요구하지 않으며, 서버도 목표 반영 여부를 검증하지 않는다.

따라서 현재 구조에서는 Gemini가 학습 목표에 맞지 않는 문제를 생성해도 백엔드가 이를 식별하거나 거부할 방법이 없다.

