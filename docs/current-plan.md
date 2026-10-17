# 오답 기반 생성 모드 (PLANS.md P2-4 2단계)

## 문제와 목표

P2-4 1단계로 "취약 개념 불러오기"는 있지만, 학생이 범위·개념·문항 수를 직접 조합해야 한다. 계획의 나머지 생성 모드(최근 틀린 문제 유사, 이번 주 복습, 시험 직전 모의고사)를 생성 창의 모드 버튼으로 추가한다. 모드는 기존 설정을 자동으로 채우고, 학생은 확인·수정 후 생성한다.

사용자 승인 범위: 모드 UI + 틀린 문제 원문 참고(요청 필드·프롬프트 변경) + 다른 인지 유형으로 변형 + "이번 주" 기간 조회(API 변경) + 노트별 최소 출제 보장(프롬프트·검증).

## 모드

| 모드 | 원천 | 채우는 설정 |
|---|---|---|
| 직접 설정(기본) | - | 지금과 같다. 참고 문제·전체 노트 출제를 끈다 |
| 최근 틀린 문제 유사 | `GET /api/quiz/incorrect/recent?courseId=&limit=10` (신규) | 범위 = 틀린 문제의 출처 블록, 집중 개념 = 개념 태그(최대 5), 유형·문항 수 = 틀린 문제의 유형별 수, `referenceQuestions` = 문제 원문 |
| 이번 주 복습 | `GET /api/quiz/incorrect/review-today?courseId=&limit=10&withinDays=6` | 위와 같은 방식 |
| 모의고사 | 강의 노트 트리 | 범위 = 노트 전체(트리 순서로 최대 20개), 객관식 10·OX 5·주관식 5, 보통, 집중 개념·참고 문제 비움, `coverAllNotes = true` |

- 출처가 없는(미검증) 틀린 문제는 범위에는 못 쓰고 개념·참고 문제에만 쓴다. 출처가 하나도 없으면 범위는 그대로 둔다.
- 데이터가 없으면 안내만 하고 설정은 바꾸지 않는다.

## 백엔드

1. `IncorrectNoteService.getRecentIncorrect(student, limit, courseId)` + `GET /api/quiz/incorrect/recent` → `List<QuestionResponse>`
   - 한 번 이상 틀린 문제를 마지막 오답 시각 내림차순으로. 기존 문제별 집계(`buildQuestionReviewStats`)를 재사용한다. limit 1~100.
2. `review-today`에 선택 파라미터 `withinDays`(기본 0, 0~13) 추가. 복습 예정일이 `오늘 + withinDays` 이전이면 대상이다. 기본값이면 기존과 같다. 요약의 복습 대상 수는 그대로 오늘 기준이다.
3. `QuizRequest` 선택 필드
   - `referenceQuestions`: `@Size(max = 10) List<@NotBlank @Size(max = 500) String>`
   - `coverAllNotes`: `Boolean`
4. 프롬프트(`PROMPT_VERSION` 갱신, 두 필드가 없으면 기존 프롬프트와 같다)
   - 참고 문제: 같은 개념을 평가하되 문장·보기·상황을 바꾸고, 원래 문제와 다른 인지 형태(비교, 사례 적용, 오개념 판별)로 물으라고 지시한다. 그대로 복사하면 이력 중복 검사(P1-4)가 재생성한다.
   - 노트별 출제: `coverAllNotes`이고 출처가 있는 노트가 2개 이상이며 총 문항 수 이상일 때만, 각 noteId에서 1문항 이상 내라고 지시한다.
5. 노트별 출제 검증: 검증을 통과한 결과에서 출처로 쓰이지 않은 노트 수(`uncoveredNotes`)를 센다. 이력 중복과 같은 "약한 조건"으로 다룬다. 0이 아니면 1회 재생성하고, 재생성 결과가 나쁘면 앞선 결과를 저장한다(실패시키지 않음). 로그에 `uncoveredNotes`를 추가한다.

## 프론트엔드

- `QuizConfigModal`에 모드 버튼 4개(`aria-pressed`)와 모드별 채우기를 추가한다. 블록 범위 채우기는 기존 `selectWeakBlocks` 방식(선택 → 패널 열기 → `loadBlocks`)을 그대로 쓴다.
- 참고 문제가 있으면 "틀린 문제 N개를 바꿔 출제합니다"를 표시한다.
- payload: 참고 문제·`coverAllNotes`가 있을 때만 필드를 넣는다(직접 설정 payload는 기존과 같다).

## 제외

- DB 변경 없음
- 모의고사 시간 제한, 모드 저장

## 검증

- 백엔드: 최근 오답 정렬·강의 필터·limit, `withinDays` 경계, 프롬프트 지시문(없으면 빈 문자열), 노트별 출제 미충족 시 1회 재생성·앞선 결과 유지, WebMvc 검증(참고 문제 11개 → 400)
- 프론트: 모드별 payload(직접 설정 payload 불변, 최근 오답 → blockSelections/focusConcepts/referenceQuestions, 모의고사 → coverAllNotes)
- `backend\gradlew.bat test`, `npm run lint`, `npm run build`, `npm run test`
- 로컬 서버에서 실제 Gemini로 세 모드 생성 확인 후 테스트 데이터 정리
- `docs/api.md` 갱신
