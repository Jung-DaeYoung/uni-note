# 취약 개념 집중 출제 (PLANS.md P2-4 1단계)

## 문제와 목표

P2-3(`8464204`)으로 강의·개념별 정답률과 취약도(`reviewPriority`)를 계산할 수 있게 되었다. 하지만 문제를 만들 때 이 결과를 쓸 방법이 없어, 자주 틀리는 개념을 다시 연습하려면 사용자가 직접 노트 범위를 골라야 한다.

이번 단계는 문제 생성 창에서 현재 강의의 취약 개념을 불러와, 그 개념을 중심으로 출제하는 기능을 추가한다. 같은 문제를 반복하지 않도록 비교·사례 적용·오개념 판별처럼 다른 형태로 묻게 한다.

## 범위

포함:

- `QuizRequest.focusConcepts`(선택) 추가와 프롬프트 반영, `PROMPT_VERSION` 갱신
- 생성 창에 "집중할 개념" 영역: "취약 개념 불러오기" 버튼, 개념 칩(개별 해제)

제외:

- 노트 범위 자동 선택. 개념은 선택한 노트 범위 안에서만 출제되며, 범위에 근거가 없는 개념은 AI가 건너뛴다(출처 규칙 유지). 기존 "취약 블록 선택"으로 범위를 좁힐 수 있다.
- PLANS.md P2-4의 나머지 모드(최근 틀린 문제와 유사한 문제, 이번 주 복습용, 시험 직전 모의고사)
- 개념 직접 입력. 학습 목표 입력란이 이미 있으므로 이번에는 통계에서 불러온 개념만 쓴다.

## API 계약

`POST /api/quiz/generate` 요청에 선택 필드를 추가한다.

```json
{ "focusConcepts": ["LRU", "FIFO"] }
```

- 최대 5개, 각 항목 1~30자(태그 정규화 길이와 같다), 공백 항목은 400 `VALIDATION_FAILED`
- 생략하거나 비어 있으면 기존 프롬프트와 같다.

## 구현

### 백엔드

- `QuizRequest.focusConcepts`: `@Size(max = 5) List<@NotBlank @Size(max = 30) String>`
- `QuizAiGenerationService.focusConceptInstruction`: 학습 목표 다음 줄에 넣는다.
  - 학습자가 자주 틀린 개념 목록과 함께, 문항 대부분이 이 개념을 다루게 한다.
  - 단순 정의 반복 대신 비교·사례 적용·오개념 판별처럼 다른 형태로 묻게 한다.
  - 노트에 근거가 없는 개념은 건너뛰게 한다.
- `PROMPT_VERSION`을 올린다. `focusConcepts`가 없으면 프롬프트 문자열은 이전과 같다.

### 프론트 (`QuizConfigModal`)

- `CourseDetailPage`에서 `courseId`를 prop으로 넘긴다.
- "집중할 개념 (선택)" 영역
  - "취약 개념 불러오기": `GET /quiz/incorrect/statistics/concepts`에서 현재 강의의 `HIGH` 개념을 서버 정렬 순서대로 최대 5개 가져온다. 없으면 "이 강의에서 자주 틀린 개념이 없습니다." 안내.
  - 개념 칩마다 ✕로 해제
  - 비어 있으면 payload에 넣지 않아 기존 payload와 같다.

### 문서

- `docs/api.md`의 `/quiz/generate` 요청 설명

## 검증

- 백엔드: 프롬프트 고정 테스트(필드 없음) 유지, 집중 개념 문구 테스트, WebMvc 검증(6개·31자·공백 → 400, 5개·30자 통과)
- 프론트: 불러오기 시 현재 강의·HIGH만 최대 5개, 없을 때 안내, 칩 해제, payload 포함·미포함
- `backend\gradlew.bat test`, `npm run lint`, `npm run build`, `npm run test`
- 로컬 서버에서 생성·풀이로 취약 개념을 만든 뒤, 화면에서 불러와 생성해 문항이 그 개념 중심인지 확인
