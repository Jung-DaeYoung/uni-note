# 개념별 정답률 지표 (PLANS.md P2-3 2단계)

## 문제와 목표

1단계(`c71b71c`)에서 문제마다 개념 태그(`Question.conceptTags`)를 저장하기 시작했다. 지금의 취약 분석은 강의별·유형별·출처 블록별까지라, "어떤 개념을 자주 틀리는지"는 알 수 없다. 블록은 노트를 고치면 바뀌거나 사라지지만 개념은 노트 수정과 여러 노트에 걸쳐 유지된다.

이번 단계는 개념 태그별 풀이 통계를 계산해 오답노트 화면에 "취약 개념"으로 보여준다. 이후 P2-4(취약 개념 기반 재출제)의 입력이 된다.

## 범위

포함:

- `GET /api/quiz/incorrect/statistics/concepts` 추가
- 오답노트 개요 화면(`WeakAreaBreakdown`)에 "취약 개념" 카드 추가

제외:

- 동의어 태그 병합. 대소문자·공백만 같게 본다(1단계 태그 정규화와 같은 규칙).
- 취약 개념으로 문제 생성(P2-4)
- 태그 도입 전 문제. 태그가 없는 문제는 이 통계에서 빠진다.

## API 계약

`GET /api/quiz/incorrect/statistics/concepts` (인증 필요, 본인 풀이만)

```json
[
  {
    "conceptTag": "LRU",
    "courseId": 1,
    "courseName": "운영체제",
    "questionCount": 3,
    "attemptCount": 5,
    "correctCount": 2,
    "incorrectCount": 3,
    "accuracyRate": 0.4,
    "reviewPriority": "HIGH"
  }
]
```

- 집계 단위는 (강의, 개념 태그)다. 같은 표기가 다른 강의에서 다른 의미일 수 있어 강의별로 나눈다. 강의가 없는 퀴즈는 `courseId`·`courseName`이 null인 묶음이 된다.
- 태그는 대소문자를 무시해 묶고, 가장 먼저 만든 문제(문제 ID 순)의 표기를 `conceptTag`로 쓴다.
- 문제에 태그가 여럿이면 각 태그에 그 문제의 풀이가 모두 더해진다.
- 정렬과 취약도는 출처 블록 통계(`/statistics/blocks`)와 같다: `reviewPriority`(HIGH → LOW) → 정답률 오름차순. 취약도 규칙은 기존 `classifyPriority`를 그대로 쓴다.

## 구현

### 백엔드

- `ConceptStatResponse` DTO 추가
- `IncorrectNoteService.getConceptStatistics`
  - 기존 `buildQuestionReviewStats`(학생의 문제별 풀이 집계) 결과를 재사용한다.
  - 블록 통계와 같은 묶음 합산(정답·오답 수, 최근 오답 여부, 우선순위)은 공용 메서드로 뽑아 두 통계가 함께 쓴다.
  - 태그 JSON 해석은 `QuestionResponseMapper`의 기존 목록 해석을 공개 메서드로 재사용한다.
- `IncorrectNoteController`에 `GET /statistics/concepts`

### 프론트

- `useIncorrectNotes`의 개요 조회에 `/statistics/concepts`를 추가한다.
- `WeakAreaBreakdown`에 "취약 개념" 카드: 상위 8개, 개념명·강의명·정답률 막대·풀이 수. 기존 `AccuracyBar`를 재사용한다.
- 태그가 있는 풀이 기록이 없으면 "개념 태그가 있는 문제를 풀면 표시됩니다." 안내

### 문서

- `docs/api.md`에 엔드포인트 추가

## 검증

- `IncorrectNoteServiceTest`: 강의·태그 단위 묶음, 대소문자 무시, 다중 태그 합산, 태그 없는 문제 제외, 정렬·우선순위, 블록 통계 회귀
- 프론트 테스트: 취약 개념 카드 렌더링과 빈 상태
- `backend\gradlew.bat test`, `npm run lint`, `npm run build`, `npm run test`
- 로컬 서버에서 실제 계정으로 문제를 생성·풀이한 뒤 `/statistics/concepts` 응답과 화면 확인
