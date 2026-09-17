# 현재 작업 계획: 스마트 오답 복습·취약 개념 리포트

## 1. 개발 목표

현재 UniNote의 오답노트는 사용자가 틀린 문제를 직접 그룹에 저장하고 다시 푸는 기능까지 구현되어 있다.

이번 작업에서는 오답노트를 다음 학습 흐름으로 확장한다.

```text
오답 저장
→ 오답 이력 집계
→ 반복 오답·취약 영역 분석
→ 오늘 복습할 문제 추천
→ 기존 오답 재풀이
→ 복습 결과 반영
```

초기 버전은 AI 없이 규칙 기반 분석으로 구현한다. 통계와 복습 추천이 안정화된 후 AI를 사용해 취약 개념 설명과 복습 가이드를 추가한다.

## 2. 현재 구현과 추가 범위

### 현재 구현된 기능

- 퀴즈 결과에서 문제별 정답·오답 표시
- 서버 재채점 및 `QuizAttempt`·`UserAnswer` 저장
- 오답노트 그룹 생성·조회·삭제
- 오답 문제 그룹 저장 및 중복 방지
- 오답 그룹 전체 다시 풀기
- 문제의 정답·해설·원본 노트 보기

### 이번에 추가할 기능

- 문제별 풀이·오답 횟수
- 최근 풀이일·최근 오답일
- 문제별 정답률
- 강의별 정답률
- 문제 유형별 정답률
- 반복 오답 분류
- 오늘의 복습 문제 목록
- 복습 우선순위
- 기존 오답 재풀이 연결
- 복습 결과 반영

## 3. 제외 범위

초기 MVP에서는 다음을 구현하지 않는다.

- AI 기반 오답 설명
- 복잡한 머신러닝 추천
- 학습 시간 측정
- 별도 통합 활동 로그 시스템
- 실시간 알림
- 고도화된 간격 반복 알고리즘
- 문제 내용 snapshot 저장

AI 오답 분석과 간격 반복 복습은 MVP 검증 이후 별도 확장 단계로 진행한다.

## 4. 작업 원칙

- 기존 퀴즈·오답노트·풀이 기록 API 계약을 유지한다.
- 통계는 인증된 현재 학생의 데이터만 포함한다.
- 서비스 계층에서 학생·퀴즈·문제·오답 그룹의 소유권을 검증한다.
- 통계 계산과 복습 우선순위는 우선 서버의 결정적 규칙으로 구현한다.
- AI는 통계 계산을 대체하지 않고 설명·요약·복습 가이드에만 사용한다.
- 새 라이브러리와 범용 추천 프레임워크를 추가하지 않는다.
- 기존 `CBTPlayer`와 오답 재풀이 흐름을 최대한 재사용한다.
- 기존 기능과 관련 없는 사용자 변경 사항을 덮어쓰거나 되돌리지 않는다.

# 1단계: 오답 문제 소유권 및 데이터 경계 보완

## 문제

현재 `IncorrectNoteService.addToGroup()`은 그룹 소유권과 문제 존재 여부를 확인하지만, 해당 문제가 현재 사용자의 퀴즈에 속하는지 명시적으로 확인해야 한다.

## 수정 방향

문제 저장 전에 다음 관계를 검증한다.

```text
Question
→ QuizSet
→ QuizSet.student == 현재 사용자
```

현재 사용자가 소유한 퀴즈의 문제만 자신의 오답 그룹에 추가할 수 있어야 한다.

## 대상

- `backend/src/main/java/com/uninote/backend/service/IncorrectNoteService.java`
- `backend/src/main/java/com/uninote/backend/repository/QuestionRepository.java`
- `backend/src/main/java/com/uninote/backend/service/QuizService.java`
- `backend/src/test/java/com/uninote/backend/service/IncorrectNoteServiceTest.java`

## 검증

- 본인 퀴즈의 문제는 저장 가능
- 다른 사용자의 문제는 `403`
- 존재하지 않는 문제는 `404`
- 다른 사용자의 오답 그룹에는 저장 불가
- 같은 그룹의 같은 문제는 중복 저장되지 않음

# 2단계: 오답 통계 조회 API

기존 `QuizAttempt`, `UserAnswer`, `Question`, `QuizSet`, `IncorrectNoteItem` 데이터를 활용해 통계를 계산한다.

## 2-1. 전체 오답 요약

```text
GET /api/quiz/incorrect/summary
```

응답 항목 예시:

- 전체 풀이 횟수
- 전체 문제 수
- 정답 수
- 오답 수
- 전체 정답률
- 복습 대상 수
- 반복 오답 수

## 2-2. 강의별 통계

```text
GET /api/quiz/incorrect/statistics/courses
```

응답 항목 예시:

- 강의 ID·강의명
- 전체 문제 수
- 정답 수·오답 수
- 강의별 정답률
- 복습 대상 수

## 2-3. 문제 유형별 통계

```text
GET /api/quiz/incorrect/statistics/types
```

응답 항목 예시:

- 문제 유형
- 풀이 수
- 오답 수
- 문제 유형별 정답률

## 2-4. 문제별 오답 통계

```text
GET /api/quiz/incorrect/questions
```

응답 항목 예시:

- 문제 ID·문제 내용
- 강의 정보
- 원본 노트·블록 ID
- 풀이 횟수
- 오답 횟수
- 정답 횟수
- 최근 풀이일
- 최근 오답일
- 문제별 정답률
- 복습 우선순위

## 구현 방향

- 전체·강의별·유형별 통계는 Repository 집계 쿼리 또는 projection을 우선 검토한다.
- 문제별 상세 목록은 필요한 관계를 조회한 뒤 Service에서 조합할 수 있다.
- 현재 데이터 규모에 맞춰 과도하게 복잡한 통합 쿼리를 만들지 않는다.
- 조회 결과는 현재 학생 소유의 풀이 기록만 사용한다.

## 대상

- `backend/src/main/java/com/uninote/backend/controller/IncorrectNoteController.java`
- `backend/src/main/java/com/uninote/backend/service/IncorrectNoteService.java`
- `backend/src/main/java/com/uninote/backend/repository/UserAnswerRepository.java`
- `backend/src/main/java/com/uninote/backend/repository/QuizAttemptRepository.java`
- `backend/src/main/java/com/uninote/backend/repository/QuestionRepository.java`
- 관련 통계 DTO와 projection

# 3단계: 복습 우선순위 규칙

문제별 통계에 기반해 복습 우선순위를 결정한다.

## 우선순위 기준

### 높은 우선순위

- 최근 풀이에서 틀림
- 2회 이상 반복 오답
- 문제별 정답률이 50% 미만
- 오랫동안 복습하지 않음

### 중간 우선순위

- 한 번 틀렸지만 아직 재풀이하지 않음
- 문제별 정답률이 50~75%
- 최근 오답이지만 반복 횟수가 낮음

### 낮은 우선순위

- 최근 재풀이에서 맞음
- 문제별 정답률이 75% 이상
- 반복 오답이 아님

## 초기 정렬 순서

복잡한 점수 공식을 먼저 도입하지 않고 다음 순서로 정렬한다.

```text
반복 오답 수
→ 최근 오답 여부
→ 마지막 복습일
→ 문제 생성일
```

필요성이 확인되면 이후 `priorityScore`를 도입한다.

# 4단계: 오늘의 복습 API

## API

```text
GET /api/quiz/incorrect/review-today
```

선택 쿼리:

```text
GET /api/quiz/incorrect/review-today?limit=10&courseId=1
```

## 응답 항목

- 문제 본문·정답·해설
- 문제 유형과 선택지
- 강의 ID·강의명
- 원본 노트·블록 ID
- 오답 횟수
- 최근 오답일
- 복습 우선순위

## 기존 기능 연결

복습 문제를 선택하면 기존 오답 재풀이 또는 `CBTPlayer` 흐름을 재사용한다.

```text
오늘의 복습 목록
→ 문제 선택
→ 기존 CBTPlayer 진입
→ 풀이
→ 서버 재채점
→ 복습 결과 반영
```

초기에는 복습 문제를 기존 `QuizSetDetailResponse`와 호환되는 형태로 묶어 전달하는 방식을 우선 검토한다.

# 5단계: 복습 결과 반영

현재 `QuizAttempt`를 일반 퀴즈 풀이와 오답 재풀이로 구분하는 별도 필드는 없다.

## MVP 방향

- 기존 `QuizAttempt` 저장 구조를 유지한다.
- 복습도 일반 풀이 기록으로 저장한다.
- 문제별 최신 정답 여부를 다음 통계 계산에 반영한다.
- 별도 복습 유형 필드는 API·DB 변경 영향이 확인된 후 추가한다.

## 후속 확장 후보

```java
public enum QuizAttemptType {
    GENERATED_QUIZ,
    INCORRECT_REVIEW
}
```

단, 이 필드는 MVP 범위에 포함하지 않는다.

# 6단계: 프론트엔드 오답 리포트 화면

## 1차 위치

현재 `QuizLibraryPage`의 오답노트 탭을 확장한다.

```text
오답노트
├─ 오늘의 복습
├─ 전체 요약
├─ 취약 강의
├─ 문제 유형별 통계
├─ 반복 오답
└─ 기존 오답 그룹
```

## UI 구성

### 상단 요약 카드

```text
전체 정답률 | 반복 오답 | 오늘의 복습 | 저장된 오답
```

### 오늘의 복습 영역

```text
오늘의 복습 문제

[자료구조] 트리 순회 문제   반복 오답 3회   [원문 보기] [다시 풀기]
[운영체제] 프로세스 문제   오답 2회       [원문 보기] [다시 풀기]
```

### 취약 영역

```text
취약 강의
자료구조   정답률 55%
운영체제   정답률 68%

취약 유형
단답형     정답률 41%
객관식     정답률 78%
```

## 대상

- `frontend/src/pages/QuizLibraryPage.jsx`
- `frontend/src/hooks/useQuizLibrary.js`
- `frontend/src/components/quiz/IncorrectGroupsPanel.jsx`
- 신규 통계 카드 컴포넌트
- 신규 복습 목록 컴포넌트
- 필요 시 `frontend/src/components/editor/components/CBTPlayer.jsx`

## 상태 처리

- 로딩 상태
- 풀이 기록이 없는 빈 상태
- 복습 대상이 없는 상태
- API 오류 상태
- 강의 필터 상태
- 야간모드 상태

# 7단계: AI 오답 분석 확장

규칙 기반 통계와 복습 추천이 안정화된 후 별도 단계로 진행한다.

## AI 입력

서버에서 선별한 데이터만 전달한다.

- 반복 오답 문제
- 문제 유형
- 정답·해설
- 원본 노트 텍스트
- 사용자 제출 답안
- 오답 횟수

## AI 출력

- 취약 개념
- 오답 원인 설명
- 원본 노트 기반 복습 가이드
- 다음 학습 노트 추천

## AI 적용 원칙

- 통계 계산은 서버의 규칙 기반 로직을 사용한다.
- AI는 설명·요약·학습 가이드 생성에만 사용한다.
- AI 실패 시 기본 통계와 복습 목록은 정상 제공한다.
- AI 분석 결과에도 `sourceNoteId`, `sourceBlockId` 출처를 유지한다.
- 생성 시각·대상 문제·모델 정보 저장 여부는 별도 검토한다.

# 8단계: 테스트 계획

## 백엔드 보안·권한

- 다른 학생의 문제를 오답노트에 추가할 수 없음
- 다른 학생의 오답 그룹에 접근할 수 없음
- 존재하지 않는 문제·그룹은 `404`
- 잘못된 요청은 `400`

## 백엔드 통계

- 풀이 기록이 없을 때 빈 통계 반환
- 정답·오답 수가 정확히 계산됨
- 여러 퀴즈의 동일 문제가 올바르게 집계됨
- 강의별 통계가 현재 학생 데이터만 포함함
- 문제 유형별 통계가 정확함
- 문제별 최근 풀이일·최근 오답일이 정확함

## 복습 추천

- 반복 오답이 우선 선택됨
- 최근 오답이 우선 선택됨
- `limit` 값이 적용됨
- `courseId` 필터가 적용됨
- 복습 대상이 없으면 빈 배열 반환

## 프론트엔드

- 오답 통계 카드 표시
- 오늘의 복습 목록 표시
- 강의 필터 작동
- 다시 풀기 버튼 작동
- 원문 보기 이동
- 로딩·빈 상태·오류 상태 표시
- 야간모드 표시
- 기존 오답 그룹 UI 회귀

## 기존 기능 회귀

- 오답 그룹 생성·삭제
- 문제 추가·중복 방지
- 오답 그룹 재풀이
- 기존 퀴즈 풀이·채점
- 원본 노트 이동

## 실행 명령

- `backend\gradlew.bat test`
- `frontend\npm.cmd run lint`
- `frontend\npm.cmd run build`

# 9단계: 권장 실행 순서

```text
현재 오답 데이터와 권한 경계 확인
→ 오답 문제 소유권 검증 보완
→ 통계 DTO·Repository 집계 설계
→ 전체·강의별·유형별 통계 API 구현
→ 문제별 오답 이력 API 구현
→ 복습 우선순위 규칙 구현
→ 오늘의 복습 API 구현
→ QuizLibraryPage 오답노트 탭 개편
→ 기존 CBTPlayer로 복습 연결
→ 복습 결과가 통계에 반영되는지 검증
→ 백엔드 테스트 작성·실행
→ 프론트 lint/build 및 화면 회귀 확인
→ 이후 AI 오답 분석 설계·구현
```

# 10단계: 완료 조건

## MVP

- 사용자는 자신의 오답 통계를 볼 수 있다.
- 문제별 오답 횟수와 최근 풀이일을 확인할 수 있다.
- 반복 오답 문제가 우선 표시된다.
- 오늘의 복습 문제를 바로 풀 수 있다.
- 문제에서 원본 노트로 이동할 수 있다.
- 다른 사용자의 문제나 오답 그룹에 접근할 수 없다.
- 기존 퀴즈·오답노트 기능이 유지된다.
- 백엔드 테스트와 프론트 lint/build가 통과한다.

## 기대 효과

현재:

> 틀린 문제를 저장하고 다시 푼다.

개발 후:

> 어떤 문제를 왜 다시 공부해야 하는지 확인하고, 추천된 문제를 바로 복습한다.

이 기능은 기존 데이터를 최대한 재사용하면서 UniNote를 AI 퀴즈 생성 도구에서 개인별 학습 약점을 분석하고 재학습까지 관리하는 서비스로 확장한다.
