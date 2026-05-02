# AI 퀴즈 생성 및 CBT 시스템 설계서 (UniNote)

## 1. 개요
UniNote 사용자가 작성한 강의 노트(텍스트 및 이미지)를 기반으로 AI가 맞춤형 문제를 생성하고, 이를 통해 자가 진단 및 학습을 수행하는 통합 CBT(Computer-Based Testing) 시스템입니다.

## 2. 핵심 기능
- **멀티모달 AI 분석**: Gemini API를 활용하여 텍스트와 이미지(OCR/맥락 분석)를 동시에 이해하고 문제 출제.
- **범위 및 단위 선택**: 에디터 내 특정 영역(우클릭 메뉴), 단일 노트 전체, 또는 다중 노트 선택을 통한 문제 생성.
- **맞춤형 설정**: 난이도(하, 중, 상) 및 문제 유형(객관식, 주관식, OX) 선택 기능.
- **영구 학습 자산화**: 생성된 퀴즈는 일회성이 아닌 DB에 저장되어 언제든 다시 풀기 및 관리 가능.
- **원문 연결 복습**: 각 문제와 원문 노트의 `blockId`를 연결하여 "원문 보기" 기능 제공.

## 3. 데이터베이스 모델 (Entity)

### 3.1 QuizSet (시험지)
- `quizSetId`: PK
- `title`: 시험지 이름
- `courseId`: 연결된 강의 ID
- `difficulty`: 난이도 (EASY, NORMAL, HARD)
- `sourceNotes`: 생성에 사용된 노트 ID 목록 (JSON)
- `createdAt`: 생성 일시

### 3.2 Question (문제)
- `questionId`: PK
- `quizSetId`: FK (시험지 연결)
- `type`: 유형 (MULTIPLE_CHOICE, SHORT_ANSWER, OX)
- `questionText`: 문제 본문
- `imagePath`: 관련 이미지 경로 (필요시)
- `options`: 객관식 보기 (JSON)
- `correctAnswer`: 정답
- `explanation`: 해설
- `sourceNoteId` / `sourceBlockId`: 원문 위치 추적용

### 3.3 QuizAttempt (풀이 기록)
- `attemptId`: PK
- `quizSetId`: FK
- `userId`: FK
- `score`: 취득 점수
- `status`: 진행 상태 (IN_PROGRESS, COMPLETED)
- `startTime` / `endTime`: 풀이 시간

### 3.4 UserAnswer (사용자 답안)
- `userAnswerId`: PK
- `attemptId`: FK
- `questionId`: FK
- `submittedAnswer`: 사용자가 입력한 답
- `isCorrect`: 정답 여부

## 4. 시스템 워크플로우

1. **생성 단계**: 
   - 범위 선택 -> 설정 입력 -> AI 요청(텍스트+이미지) -> JSON 수신 -> DB 저장 -> 시험지 생성 완료.
2. **풀이 단계**:
   - 시험지 선택 -> 풀이 시작(Attempt 생성) -> 답안 입력(UserAnswer 저장) -> 제출 및 자동 채점.
3. **학습 단계**:
   - 결과 리포트 확인 -> 틀린 문제 해설 보기 -> '원문 보기' 클릭 시 에디터 해당 위치로 이동.

## 5. UI/UX 구성
- **Context Menu**: 에디터 드래그 영역 우클릭 시 'AI 문제 생성' 메뉴.
- **Quiz Modal**: 난이도/유형/소스 요약 확인 및 생성 트리거.
- **Study Room**: 사이드바의 퀴즈 목록 및 과거 기록 관리 공간.
- **CBT Player**: 문제 풀이에 최적화된 인터랙티브 전체 화면 인터페이스.
