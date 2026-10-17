# 개념 태그·학습 목표 기반 문제 생성 (PLANS.md 구현 순서 10번, P2-1 1단계)

## 문제와 목표

현재 문제에는 출처 블록(`sourceNoteId`, `sourceBlockId`)만 있어 "어떤 개념을 묻는 문제인지"가 데이터로 남지 않는다. 블록은 노트 수정으로 바뀌거나 사라지므로 개념 단위의 취약 분석(P2-3 개념별 정답률)과 오답 기반 재출제(P2-4)를 할 수 없다. 또 생성 입력이 노트 범위·유형·난이도뿐이라 사용자가 평가하고 싶은 학습 목표를 지정할 수 없다.

이번 단계는 두 가지를 추가한다.

1. 문제별 개념 태그(`conceptTags`)를 AI가 함께 생성하고 저장·응답한다.
2. 생성 요청에 선택적 학습 목표(`learningObjectives`)를 받아 프롬프트에 반영한다.

마이페이지 계획(이전 `current-plan.md`)은 1차 `2051d2f`, 2차 `92e0466`, 보완 `2b7aaa3`으로 완료했다.

## 범위

포함:

- `Question.conceptTags` 저장(JSON 문자열, `options`와 같은 방식)
- Gemini 프롬프트·응답 스키마에 `conceptTags` 추가, `PROMPT_VERSION` 갱신
- `QuizQualityValidator`에서 태그 정규화
- `QuizRequest.learningObjectives`(선택) 추가와 프롬프트 반영
- `QuestionResponse.conceptTags` 응답(추가 필드만, 기존 필드 유지)
- 공유 시험 스냅샷 복사 시 태그 복사
- 프론트: 생성 모달의 학습 목표 입력, CBT 결과 화면의 개념 태그 표시
- 운영 DDL과 문서(`docs/database.md`, `docs/api.md`)

제외(후속 단계):

- 개념별 정답률·취약 개념 지표(P2-3 2단계)
- 오답·취약 개념 기반 생성 모드(P2-4)
- `cognitiveLevel`, `learningObjectiveId` 저장. 난이도 기준(P2-2)은 이미 프롬프트에 있고, 목표 ID를 저장할 학습 목표 엔티티가 없으므로 지금은 만들지 않는다.
- 동의어 태그 병합. 1단계는 공백·대소문자 정규화와 중복 제거만 한다.

## API 계약

`POST /api/quiz/generate` 요청에 선택 필드를 추가한다.

```json
{
  "noteIds": [10],
  "typeCounts": { "MULTIPLE_CHOICE": 5 },
  "difficulty": "NORMAL",
  "learningObjectives": ["페이지 교체 알고리즘의 차이를 비교할 수 있다"]
}
```

- 최대 5개, 각 항목 1~100자, 공백만 있는 항목은 400 `VALIDATION_FAILED`
- 생략하거나 빈 배열이면 기존과 같은 프롬프트로 생성한다.

문제 응답(`QuestionResponse`)에 `conceptTags: string[]`를 추가한다. 생성 응답, 퀴즈 상세, 풀이 상세, 공유 시험, 오답노트 등 `QuestionResponseMapper`를 쓰는 모든 응답에 함께 나간다. 태그가 없는 기존 문제는 빈 배열이다.

## 구현 단계

### 1. 백엔드 저장

- `Question`에 `@Column(columnDefinition = "TEXT") private String conceptTags;` 추가(JSON 배열 문자열)
- `QuizService.saveGeneratedQuiz`에서 `writeJson(qr.getConceptTags())`로 저장
- `QuestionResponseMapper`에서 읽고, null이나 파싱 실패는 빈 배열(`options`와 같은 처리)
- `SharedQuizService.snapshotOf`에서 태그도 복사한다(출처만 복사하지 않는 기존 규칙 유지).

### 2. 프롬프트·스키마 (`QuizAiGenerationService.requestQuiz`)

- 문항 schema에 `conceptTags: ARRAY<STRING>`을 추가하고 required에 넣는다.
- 지시문: 각 문항이 평가하는 핵심 개념을 1~3개, 노트에 쓰인 용어 그대로 짧은 명사구(20자 이내)로 쓴다. 같은 개념은 세트 안에서 같은 표기를 쓴다.
- 학습 목표가 있으면 목록을 프롬프트에 넣고, 문항이 목표를 평가하도록 출제하게 한다. 목표가 노트 내용과 관련이 없으면 노트 내용을 우선한다(출처 규칙 유지).
- `PROMPT_VERSION`을 올린다.

### 3. 검증 (`QuizQualityValidator`)

- 태그는 문항 실패 사유로 쓰지 않는다(재생성 비용이 들 만큼 중요한 필드가 아니다). 검증 통과 후 정규화만 한다.
- 정규화: trim, 연속 공백 1칸, 빈 값 제거, 대소문자 무시 중복 제거, 30자 초과 항목 제거, 최대 3개

### 4. 프론트

- `QuizConfigModal`: 난이도 아래 "학습 목표 (선택)" textarea. 한 줄에 하나, 최대 5줄·줄당 100자. 비어 있으면 payload에 넣지 않아 기존 payload와 동일하다.
- `CBTPlayer` 결과 화면: 해설 위에 개념 태그 칩. 태그가 없으면 표시하지 않는다.

### 5. 운영 DDL

```sql
ALTER TABLE questions ADD COLUMN concept_tags TEXT NULL;
```

`docs/database.md`에 기록한다. 운영은 `ddl-auto: validate`이므로 배포 전에 실행해야 한다.

## 검증

- 백엔드 단위 테스트
  - 태그 정규화(공백·중복·길이·개수)
  - 저장 시 태그 JSON, 매퍼의 null·파싱 실패 → 빈 배열
  - 학습 목표 유무에 따른 프롬프트 내용, schema required에 `conceptTags` 포함
  - `learningObjectives` 6개·101자·공백 항목 → 400 (WebMvc)
  - 공유 스냅샷의 태그 복사
- 회귀: 기존 `QuizServiceTest`의 `generateQuiz*`, `QuizControllerWebMvcTest`, `QuizQualityValidatorTest` 통과
- 프론트: 학습 목표 없을 때 payload가 기존과 같음, 입력 시 줄 단위 배열로 전송, 결과 화면 태그 표시
- `backend\gradlew.bat test`, `npm run lint`, `npm run build`, `npm run test`
- 로컬 서버(`ddl-auto: update`)로 실제 Gemini 호출 1회: 태그가 저장·응답되는지, 학습 목표가 반영되는지 확인
