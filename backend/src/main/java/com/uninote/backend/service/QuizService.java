package com.uninote.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uninote.backend.domain.*;
import com.uninote.backend.dto.*;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.exception.ExternalServiceException;
import com.uninote.backend.exception.InvalidRequestException;
import com.uninote.backend.exception.ResourceNotFoundException;
import com.uninote.backend.exception.TooManyRequestsException;
import com.uninote.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuizService {
    // AI 요청 폭주/오남용을 막기 위한 최소한의 상한선. 실제 UI는 이보다 훨씬 적은 수를
    // 기본값으로 쓰지만, 클라이언트가 값을 임의로 조작해 보낼 수 있으므로 서버에서도 제한한다.
    private static final int MAX_NOTES_PER_QUIZ = 20;
    private static final int MAX_TOTAL_QUESTIONS = 30;
    // 블록 범위 선택 시 모든 노트를 합친 선택 블록 수 상한(QuizConfigModal과 동일).
    private static final int MAX_SELECTED_BLOCKS = 500;
    // AI에 보낼 추출 텍스트(REF 태그 포함) 글자 수 상한(P1-2). 토큰 초과·비용·지연을 막는다.
    // ponytail: 글자 수 근사치, 토큰 단위 제한이 필요하면 Gemini countTokens로 바꾼다.
    static final int MAX_INPUT_TEXT_CHARS = 200_000;
    // AI 생성 결과 검증 실패 시 재생성은 1회만 한다(요청당 AI 호출 최대 2회).
    private static final int MAX_AI_ATTEMPTS = 2;
    // 전체 시간 예산 90초 - Gemini read timeout 60초(RestClientConfig). 첫 호출이 이보다 오래
    // 걸렸으면 재생성하지 않아야 최악의 경우에도 90초 안에 끝난다.
    private static final Duration MAX_ELAPSED_FOR_RETRY = Duration.ofSeconds(30);
    private static final String VALIDATION_FAILED_MESSAGE =
            "요청한 조건에 맞는 문제를 생성하지 못했습니다. 범위나 문항 수를 조정해 주세요.";
    // 생성 결과 로그 전용 실패 코드. 저장 단계 예외는 기존 GlobalExceptionHandler 응답을 그대로 따른다.
    private static final String STORAGE_ERROR = "STORAGE_ERROR";
    // 학생별 AI 호출 제한(P1-2). 동시 생성은 학생당 1건, 호출 빈도는 10분에 5회.
    // ponytail: 서버 1대 메모리 기준이며 재시작 시 초기화된다. 서버를 여러 대로 늘리면 Redis 등 공유 저장소로 옮긴다.
    // 학생 수만큼 deque가 남지만 항목은 학생당 최대 MAX_GENERATIONS_PER_WINDOW개다.
    static final int MAX_GENERATIONS_PER_WINDOW = 5;
    static final Duration GENERATION_WINDOW = Duration.ofMinutes(10);
    // 이력 대비 중복 검사(P1-4)에 쓰는 같은 학생·같은 강의의 최근 문제 수.
    static final int RECENT_QUESTION_HISTORY_SIZE = 200;
    private final Set<Long> generatingStudents = ConcurrentHashMap.newKeySet();
    private final Map<Long, Deque<Instant>> recentGenerations = new ConcurrentHashMap<>();

    private final NoteRepository noteRepository;
    private final QuizSetRepository quizSetRepository;
    private final QuizAttemptRepository quizAttemptRepository;
    private final UserAnswerRepository userAnswerRepository;
    private final QuestionRepository questionRepository;
    private final ObjectMapper objectMapper;
    private final QuizAiGenerationService quizAiGenerationService;
    private final QuestionResponseMapper questionResponseMapper;
    private final IncorrectNoteItemRepository incorrectNoteItemRepository;
    private final QuizQualityValidator quizQualityValidator;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    // AI 호출·검증은 트랜잭션 밖에서 하고(재생성 시 DB 트랜잭션을 오래 잡지 않도록), 검증을 통과한
    // 결과만 저장 트랜잭션으로 묶는다. 같은 클래스 내부 호출은 @Transactional 프록시를 타지 않으므로
    // TransactionTemplate을 쓴다.
    public QuizResponse generateQuiz(QuizRequest request, Student student) {
        List<Note> notes = noteRepository.findAllById(request.getNoteIds());
        validateNoteAccess(request.getNoteIds(), notes, student);
        validateGenerationLimits(request, notes);
        Map<Long, Set<String>> blockScopes = resolveBlockScopes(request);

        QuizGenerationInput input = quizAiGenerationService.prepareInput(notes, student, blockScopes);
        if (input.isEmpty()) {
            throw new InvalidRequestException(blockScopes.isEmpty()
                    ? "문제를 생성할 노트 내용이 없습니다."
                    : "선택한 범위에 문제를 생성할 내용이 없습니다.");
        }
        if (input.text().length() > MAX_INPUT_TEXT_CHARS) {
            // P1-1 청킹 착수 판단용 빈도 측정. 노트 본문은 남기지 않는다.
            log.info("quiz.generation status=REJECTED_TOO_LONG textChars={} studId={}",
                    input.text().length(), student.getStudId());
            throw new InvalidRequestException(String.format(
                    "노트 내용이 너무 깁니다(%,d자, 최대 %,d자). 노트 수를 줄이거나 블록 범위를 선택해 주세요.",
                    input.text().length(), MAX_INPUT_TEXT_CHARS));
        }

        // 입력 검증을 모두 통과한 요청만 호출 제한에 센다(입력 오류는 횟수를 쓰지 않는다).
        Instant start = acquireGenerationSlot(student.getStudId());
        try {
            GenerationContext context = new GenerationContext(start, student.getStudId(), blockScopes,
                    sha256Hex(input.text()), input.text().length());
            Set<String> previousQuestionTexts = loadPreviousQuestionTexts(student.getStudId(), notes.get(0).getCourse());
            GenerationResult result = generateValidatedQuiz(request, input, context, previousQuestionTexts);

            QuizResponse saved;
            try {
                saved = transactionTemplate.execute(status -> saveGeneratedQuiz(result.response(), request, notes, student));
            } catch (RuntimeException e) {
                logGenerationResult(context, false, result.attempts(), result.unverifiedCount(),
                        result.historyDuplicates(), STORAGE_ERROR, e.getMessage(), null);
                throw e;
            }
            logGenerationResult(context, true, result.attempts(), result.unverifiedCount(),
                    result.historyDuplicates(), null, null, saved.getQuizSetId());
            return saved;
        } finally {
            generatingStudents.remove(student.getStudId());
        }
    }

    // 동시 생성·호출 빈도 제한을 확인하고 이번 호출을 기록한다. 반환값은 생성 시작 시각이다.
    // AI 호출이 실패해도 비용이 들었으므로 횟수에 포함한다.
    private Instant acquireGenerationSlot(Long studId) {
        if (!generatingStudents.add(studId)) {
            log.info("quiz.generation status=RATE_LIMITED reason=CONCURRENT studId={}", studId);
            throw new TooManyRequestsException("이미 문제를 생성하고 있습니다. 완료된 뒤 다시 시도해 주세요.");
        }
        Instant now = clock.instant();
        Deque<Instant> recent = recentGenerations.computeIfAbsent(studId, k -> new ArrayDeque<>());
        synchronized (recent) {
            Instant windowStart = now.minus(GENERATION_WINDOW);
            while (!recent.isEmpty() && !recent.peekFirst().isAfter(windowStart)) {
                recent.pollFirst();
            }
            if (recent.size() >= MAX_GENERATIONS_PER_WINDOW) {
                generatingStudents.remove(studId);
                long waitSeconds = Duration.between(windowStart, recent.peekFirst()).toSeconds();
                long waitMinutes = Math.max(1, (waitSeconds + 59) / 60);
                log.info("quiz.generation status=RATE_LIMITED reason=WINDOW studId={}", studId);
                throw new TooManyRequestsException(String.format(
                        "문제 생성은 %d분에 %d회까지 할 수 있습니다. %d분 후 다시 시도해 주세요.",
                        GENERATION_WINDOW.toMinutes(), MAX_GENERATIONS_PER_WINDOW, waitMinutes));
            }
            recent.addLast(now);
        }
        return now;
    }

    // 생성 결과 로그(P0-4)에 공통으로 남기는 요청 단위 정보.
    // blockScopes는 noteId별 선택 블록이며, 비어 있으면 모든 노트를 전체로 쓴다.
    // contentHash는 AI에 보낸 추출 텍스트의 SHA-256으로, 본문 없이 같은 입력인지 식별한다.
    private record GenerationContext(Instant start, Long studId, Map<Long, Set<String>> blockScopes,
                                     String contentHash, int textChars) {}

    private static String sha256Hex(String text) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256을 사용할 수 없습니다.", e);
        }
    }

    // 노트별 블록 범위(P1-5). 블록을 고른 노트는 반드시 noteIds에 있어야 한다 — noteIds가
    // 소유권·같은 강의 검증(validateNoteAccess)의 기준이므로 이를 우회하지 못하게 한다.
    private Map<Long, Set<String>> resolveBlockScopes(QuizRequest request) {
        List<QuizRequest.BlockSelection> selections = request.getBlockSelections();
        if (selections == null || selections.isEmpty()) {
            return Map.of();
        }
        Set<Long> requestedNoteIds = new HashSet<>(request.getNoteIds());
        Map<Long, Set<String>> scopes = new HashMap<>();
        for (QuizRequest.BlockSelection selection : selections) {
            if (!requestedNoteIds.contains(selection.getNoteId())) {
                throw new InvalidRequestException("블록을 선택한 노트가 요청 노트 목록에 없습니다.");
            }
            scopes.computeIfAbsent(selection.getNoteId(), k -> new HashSet<>()).addAll(selection.getBlockIds());
        }
        int totalBlocks = scopes.values().stream().mapToInt(Set::size).sum();
        if (totalBlocks > MAX_SELECTED_BLOCKS) {
            throw new InvalidRequestException("한 번에 선택할 수 있는 블록은 최대 " + MAX_SELECTED_BLOCKS + "개입니다.");
        }
        return scopes;
    }

    // historyDuplicates는 같은 학생·같은 강의의 이전 문제와 문장이 같은 문항 수다(P1-4).
    private record GenerationResult(QuizResponse response, int attempts, int unverifiedCount, int historyDuplicates) {
        GenerationResult withAttempts(int totalAttempts) {
            return new GenerationResult(response, totalAttempts, unverifiedCount, historyDuplicates);
        }
    }

    // 검증 통과 결과에 이전 문제와 같은 문항이 있으면 1회 재생성한다. 재생성이 검증 실패·AI 오류로
    // 끝나면 이미 쓸 수 있는 앞선 결과를 저장하고, 둘 다 중복이면 중복이 적은 쪽을 쓴다(실패시키지 않음).
    private GenerationResult generateValidatedQuiz(QuizRequest request, QuizGenerationInput input,
                                                   GenerationContext context, Set<String> previousQuestionTexts) {
        int lastUnverified = 0;
        GenerationResult duplicateFallback = null;
        for (int attempt = 1; ; attempt++) {
            String failure;
            try {
                QuizResponse response = quizAiGenerationService.requestQuiz(request, input);
                QuizQualityValidator.Result result =
                        quizQualityValidator.validate(response, request, input.allowedSources());
                if (result.valid()) {
                    GenerationResult current = new GenerationResult(response, attempt, result.unverifiedCount(),
                            countHistoryDuplicates(response, previousQuestionTexts));
                    if (duplicateFallback != null && duplicateFallback.historyDuplicates() <= current.historyDuplicates()) {
                        current = duplicateFallback.withAttempts(attempt);
                    }
                    if (current.historyDuplicates() > 0 && canRegenerate(attempt, context)) {
                        log.info("이전 문제와 같은 문항 {}개가 있어 재생성합니다.", current.historyDuplicates());
                        duplicateFallback = current;
                        continue;
                    }
                    return accept(current);
                }
                lastUnverified = result.unverifiedCount();
                failure = String.join(" / ", result.errors());
            } catch (ExternalServiceException e) {
                // 호출 실패·타임아웃은 재생성해도 같은 결과일 가능성이 높고 시간 예산만 소모하므로 그대로 전파한다.
                if (!ExternalServiceException.AI_RESPONSE_INVALID.equals(e.getErrorCode())) {
                    if (duplicateFallback != null) {
                        log.warn("중복 재생성 중 AI 호출 실패, 앞선 결과를 저장합니다: {}", e.getMessage());
                        return accept(duplicateFallback.withAttempts(attempt));
                    }
                    logGenerationResult(context, false, attempt, 0, 0, e.getErrorCode(), e.getMessage(), null);
                    throw e;
                }
                lastUnverified = 0;
                failure = e.getMessage();
            }

            if (duplicateFallback != null) {
                log.warn("중복 재생성 결과 검증 실패, 앞선 결과를 저장합니다: {}", failure);
                return accept(duplicateFallback.withAttempts(attempt));
            }
            Duration elapsed = Duration.between(context.start(), clock.instant());
            log.warn("AI 퀴즈 생성 결과 검증 실패 (시도 {}/{}, 경과 {}초): {}",
                    attempt, MAX_AI_ATTEMPTS, elapsed.toSeconds(), failure);
            if (attempt >= MAX_AI_ATTEMPTS || elapsed.compareTo(MAX_ELAPSED_FOR_RETRY) > 0) {
                logGenerationResult(context, false, attempt, lastUnverified, 0,
                        ExternalServiceException.QUIZ_VALIDATION_FAILED, failure, null);
                throw new ExternalServiceException(ExternalServiceException.QUIZ_VALIDATION_FAILED,
                        VALIDATION_FAILED_MESSAGE);
            }
        }
    }

    private boolean canRegenerate(int attempt, GenerationContext context) {
        return attempt < MAX_AI_ATTEMPTS
                && Duration.between(context.start(), clock.instant()).compareTo(MAX_ELAPSED_FOR_RETRY) <= 0;
    }

    private GenerationResult accept(GenerationResult result) {
        if (result.unverifiedCount() > 0) {
            log.info("출처를 확인할 수 없는 문항 {}개는 출처 없이 저장합니다.", result.unverifiedCount());
        }
        if (result.historyDuplicates() > 0) {
            log.info("이전 문제와 같은 문항 {}개를 그대로 저장합니다.", result.historyDuplicates());
        }
        return result;
    }

    // 같은 학생·같은 강의의 최근 문제 문장(정규화). 강의가 없으면 비교하지 않는다.
    private Set<String> loadPreviousQuestionTexts(Long studId, Course course) {
        if (course == null) {
            return Set.of();
        }
        return questionRepository.findRecentQuestionTexts(studId, course.getCourseId(),
                        PageRequest.of(0, RECENT_QUESTION_HISTORY_SIZE)).stream()
                .filter(Objects::nonNull)
                .map(QuizQualityValidator::normalize)
                .collect(Collectors.toSet());
    }

    private static int countHistoryDuplicates(QuizResponse response, Set<String> previousQuestionTexts) {
        return (int) response.getQuestions().stream()
                .filter(q -> previousQuestionTexts.contains(QuizQualityValidator.normalize(q.getQuestionText())))
                .count();
    }

    // AI 생성 요청 1건당 결과 한 줄을 key=value 형식으로 남긴다. 추후 품질 분석·재현에 쓰며,
    // 노트 본문·문제 텍스트·학번 같은 개인정보는 넣지 않는다(사용자는 내부 studId로만 식별).
    private void logGenerationResult(GenerationContext context, boolean success, int attempts, int unverified,
                                     int historyDuplicates, String failureCode, String failureReason, Long quizSetId) {
        log.info("quiz.generation status={} model={} promptVersion={} attempts={} "
                        + "unverified={} historyDuplicates={} elapsedMs={} failureCode={} failureReason=\"{}\" quizSetId={} studId={} "
                        + "blockCount={} blockNoteCount={} contentHash={} textChars={}",
                success ? "SUCCESS" : "FAILED",
                QuizAiGenerationService.MODEL_NAME,
                QuizAiGenerationService.PROMPT_VERSION,
                attempts,
                unverified,
                historyDuplicates,
                Duration.between(context.start(), clock.instant()).toMillis(),
                failureCode == null ? "" : failureCode,
                failureReason == null ? "" : failureReason.replace("\"", "'"),
                quizSetId == null ? "" : quizSetId,
                context.studId(),
                context.blockScopes().values().stream().mapToInt(Set::size).sum(),
                context.blockScopes().size(),
                context.contentHash(),
                context.textChars());
    }

    private QuizResponse saveGeneratedQuiz(QuizResponse quizResponse, QuizRequest request, List<Note> notes,
                                           Student student) {
        QuizSet quizSet = new QuizSet();
        quizSet.setTitle(quizResponse.getTitle());
        quizSet.setDifficulty(request.getDifficulty());
        quizSet.setSourceNotes(writeJson(request.getNoteIds()));
        quizSet.setStudent(student);
        quizSet.setCourse(notes.get(0).getCourse());

        quizSetRepository.save(quizSet);

        for (QuestionResponse qr : quizResponse.getQuestions()) {
            Question question = new Question();
            question.setQuizSet(quizSet);
            question.setType(qr.getType());
            question.setQuestionText(qr.getQuestionText());
            question.setOptions(writeJson(qr.getOptions()));
            question.setCorrectAnswer(qr.getCorrectAnswer());
            question.setExplanation(qr.getExplanation());
            question.setSourceNoteId(qr.getSourceNoteId());
            question.setSourceBlockId(qr.getSourceBlockId());

            Question savedQuestion = questionRepository.save(question);
            qr.setQuestionId(savedQuestion.getQuestionId()); // ID 주입
            quizSet.getQuestions().add(savedQuestion);
        }
        quizResponse.setQuizSetId(quizSet.getQuizSetId()); // QuizResponse에도 ID 추가 필요
        return quizResponse;
    }

    // request.getNoteIds()/qr.getOptions()는 이미 검증된 내부 데이터라 직렬화 실패가
    // 사실상 발생하지 않지만, 체크 예외를 상위로 전파하지 않기 위해 감싼다.
    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new ExternalServiceException("퀴즈 저장 중 오류가 발생했습니다.");
        }
    }

    // AI 요청 폭주를 막기 위한 최소 검증. 실제 문제 생성 품질(문항 배분 등)은 AI 프롬프트의
    // 책임이며, 여기서는 요청 크기 자체가 비정상적으로 큰 경우만 차단한다.
    private void validateGenerationLimits(QuizRequest request, List<Note> notes) {
        if (notes.size() > MAX_NOTES_PER_QUIZ) {
            throw new InvalidRequestException("한 번에 최대 " + MAX_NOTES_PER_QUIZ + "개의 노트까지 사용할 수 있습니다.");
        }

        // 유형별 개수(1~20, null 불가)는 QuizRequest의 Bean Validation이 검증한다.
        int total = request.getTypeCounts().values().stream().mapToInt(Integer::intValue).sum();
        if (total > MAX_TOTAL_QUESTIONS) {
            throw new InvalidRequestException("한 번에 생성할 수 있는 총 문제 수는 최대 " + MAX_TOTAL_QUESTIONS + "개입니다.");
        }
    }

    @Transactional
    public void deleteQuiz(Long quizSetId, Student student) {
        QuizSet quizSet = quizSetRepository.findById(quizSetId)
            .orElseThrow(() -> new ResourceNotFoundException("퀴즈를 찾을 수 없습니다."));

        validateOwnership(quizSet.getStudent(), student, "본인 퀴즈만 삭제할 수 있습니다.");

        // 오답노트 항목과 (오답노트/오늘의 복습 등) 가상 세션의 답안은 QuizSet cascade 밖에
        // 있어 Question 삭제 전에 먼저 지워야 FK 제약 위반(DataIntegrityViolationException)을
        // 피할 수 있다. 가상 세션 QuizAttempt는 quizSet이 null이라 QuizSet.attempts cascade로는
        // 정리되지 않는다.
        incorrectNoteItemRepository.deleteByQuestion_QuizSet_QuizSetId(quizSetId);
        userAnswerRepository.deleteByQuestion_QuizSet_QuizSetId(quizSetId);
        quizSetRepository.delete(quizSet);
    }

    @Transactional(readOnly = true)
    public List<QuizSetResponse> getMyQuizzes(Student student) {
        return quizSetRepository.findByStudent_StudId(student.getStudId()).stream()
            .map(qs -> QuizSetResponse.builder()
                .quizSetId(qs.getQuizSetId())
                .courseId(qs.getCourse() != null ? qs.getCourse().getCourseId() : null)
                .title(qs.getTitle())
                .courseName(qs.getCourse() != null ? qs.getCourse().getCourseName() : "Unknown Course")
                .difficulty(qs.getDifficulty())
                .createdAt(qs.getCreatedAt())
                .build())
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public QuizSetDetailResponse getQuizDetail(Long quizSetId, Student student) {
        QuizSet quizSet = quizSetRepository.findById(quizSetId)
            .orElseThrow(() -> new ResourceNotFoundException("퀴즈를 찾을 수 없습니다."));

        validateOwnership(quizSet.getStudent(), student, "본인 퀴즈만 조회할 수 있습니다.");

        List<QuestionResponse> questions = quizSet.getQuestions().stream()
            .map(questionResponseMapper::toResponse)
            .collect(Collectors.toList());

        return QuizSetDetailResponse.builder()
            .quizSetId(quizSet.getQuizSetId())
            .title(quizSet.getTitle())
            .difficulty(quizSet.getDifficulty())
            .questions(questions)
            .build();
    }

    // quizSetId가 없거나 음수면 가상 세션(오답노트 재풀이/오늘의 복습)으로 간주해 quizSet 없이
    // 저장한다. IncorrectNoteService.getPracticeSession()이 반환하는 quizSetId(-1L)과 동일한
    // 관례를 공유한다 — 전에는 이 경로가 quizSetRepository.findById(-1L)에서 404로 실패했고,
    // 프론트(CBTPlayer.handleSubmit)가 그 오류를 조용히 삼켜 사용자에게는 저장된 것처럼
    // 보였지만 실제로는 QuizAttempt/UserAnswer가 전혀 남지 않았다.
    @Transactional
    public void saveAttempt(QuizAttemptRequest request, Student student) {
        Long requestedQuizSetId = request.getQuizSetId();
        boolean isVirtualSession = requestedQuizSetId == null || requestedQuizSetId < 0;

        QuizSet quizSet = null;
        if (!isVirtualSession) {
            quizSet = quizSetRepository.findById(requestedQuizSetId)
                .orElseThrow(() -> new ResourceNotFoundException("퀴즈를 찾을 수 없습니다."));
            validateOwnership(quizSet.getStudent(), student, "본인 퀴즈만 풀이할 수 있습니다.");
        }

        // 제출된 답안을 서버가 직접 채점한다. 클라이언트가 보낸 score/isCorrect는 신뢰하지 않는다.
        List<UserAnswer> gradedAnswers = new ArrayList<>();
        int correctCount = 0;
        for (QuizAttemptRequest.UserAnswerRequest uar : request.getUserAnswers()) {
            Question question = questionRepository.findById(uar.getQuestionId())
                .orElseThrow(() -> new ResourceNotFoundException("문제를 찾을 수 없습니다."));

            if (quizSet != null) {
                if (!question.getQuizSet().getQuizSetId().equals(quizSet.getQuizSetId())) {
                    throw new InvalidRequestException("해당 퀴즈에 속하지 않는 문제입니다.");
                }
            } else {
                // 가상 세션은 단일 quizSet이 없으므로 문제 단위로 소유권을 검증한다.
                validateOwnership(question.getQuizSet().getStudent(), student, "본인 문제만 풀이할 수 있습니다.");
            }

            boolean isCorrect = isAnswerCorrect(question.getType(), uar.getSubmittedAnswer(), question.getCorrectAnswer());
            if (isCorrect) {
                correctCount++;
            }

            UserAnswer userAnswer = new UserAnswer();
            userAnswer.setQuestion(question);
            userAnswer.setSubmittedAnswer(uar.getSubmittedAnswer());
            userAnswer.setIsCorrect(isCorrect);
            gradedAnswers.add(userAnswer);
        }

        QuizAttempt attempt = new QuizAttempt();
        attempt.setQuizSet(quizSet); // 가상 세션이면 null
        attempt.setStudent(student);
        attempt.setScore(correctCount);
        attempt.setStatus(QuizStatus.COMPLETED);
        attempt.setStartTime(LocalDateTime.now()); // 수동 설정
        attempt.setEndTime(LocalDateTime.now());

        quizAttemptRepository.save(attempt);

        for (UserAnswer userAnswer : gradedAnswers) {
            userAnswer.setQuizAttempt(attempt);
            userAnswerRepository.save(userAnswer);
        }
    }

    // 채점 규칙. 프론트 CBTPlayer.isCorrectAt과 같은 규칙이므로 바꿀 때 함께 수정한다.
    // 객관식·OX는 trim + 소문자, 주관식은 추가로 모든 공백과 앞뒤 문장부호를 무시한다(P2-6 1차).
    private static boolean isAnswerCorrect(QuestionType type, String submittedAnswer, String correctAnswer) {
        return normalizeAnswer(type, submittedAnswer).equals(normalizeAnswer(type, correctAnswer));
    }

    private static String normalizeAnswer(QuestionType type, String answer) {
        String value = answer == null ? "" : answer.trim().toLowerCase();
        if (type != QuestionType.SHORT_ANSWER) {
            return value;
        }
        // (?U): JS의 \s처럼 유니코드 공백(전각 공백 등)까지 지운다.
        return value.replaceAll("(?U)\\s+", "")
                .replaceAll("^[.,!?;:'\"“”‘’。]+|[.,!?;:'\"“”‘’。]+$", "");
    }

    @Transactional(readOnly = true)
    public List<QuizAttemptResponse> getMyAttempts(Student student) {
        return convertToAttemptResponses(quizAttemptRepository.findByStudent_StudId(student.getStudId()));
    }

    @Transactional(readOnly = true)
    public QuizAttemptDetailResponse getAttemptDetail(Long attemptId, Student student) {
        QuizAttempt attempt = quizAttemptRepository.findById(attemptId)
            .orElseThrow(() -> new ResourceNotFoundException("기록을 찾을 수 없습니다."));

        validateOwnership(attempt.getStudent(), student, "본인 풀이 기록만 조회할 수 있습니다.");

        List<QuizAttemptDetailResponse.UserAnswerDetailResponse> answers = attempt.getUserAnswers().stream()
            .map(ua -> {
                Question q = ua.getQuestion();
                QuestionResponse qr;
                if (q != null) {
                    qr = questionResponseMapper.toResponse(q);
                } else {
                    qr = new QuestionResponse();
                    qr.setQuestionText("(삭제된 문항입니다)");
                    qr.setOptions(new ArrayList<>());
                    qr.setCorrectAnswer("-");
                }

                return QuizAttemptDetailResponse.UserAnswerDetailResponse.builder()
                    .question(qr)
                    .submittedAnswer(ua.getSubmittedAnswer())
                    .isCorrect(ua.getIsCorrect())
                    .build();
            })
            .collect(Collectors.toList());

        QuizSet quizSet = attempt.getQuizSet();
        return QuizAttemptDetailResponse.builder()
            .attemptId(attempt.getAttemptId())
            .quizSetId(quizSet != null ? quizSet.getQuizSetId() : null)
            .courseId(quizSet != null && quizSet.getCourse() != null ? quizSet.getCourse().getCourseId() : null)
            .quizTitle(quizSet != null ? quizSet.getTitle() : "오답 복습")
            .difficulty(quizSet != null && quizSet.getDifficulty() != null ? quizSet.getDifficulty().name() : "NORMAL")
            .score(attempt.getScore())
            .createdAt(attempt.getStartTime())
            .userAnswers(answers)
            .build();
    }

    @Transactional(readOnly = true)
    public List<QuizAttemptResponse> getAttemptsByQuizSet(Long quizSetId, Student student) {
        return convertToAttemptResponses(
                quizAttemptRepository.findByQuizSet_QuizSetIdAndStudent_StudId(quizSetId, student.getStudId()));
    }

    // 세트별 문제 "개수"만 필요하므로, 풀이 기록마다 전체 문제 컬렉션을 lazy loading하는
    // 대신 등장한 quizSetId들의 개수를 한 번의 쿼리로 배치 조회한다.
    private List<QuizAttemptResponse> convertToAttemptResponses(List<QuizAttempt> attempts) {
        List<Long> quizSetIds = attempts.stream()
                .map(QuizAttempt::getQuizSet)
                .filter(Objects::nonNull) // 가상 세션(quizSet=null) 기록은 문제 수 배치 조회 대상에서 제외
                .map(QuizSet::getQuizSetId)
                .distinct()
                .collect(Collectors.toList());
        Map<Long, Long> questionCountByQuizSetId = quizSetIds.isEmpty()
                ? Map.of()
                : questionRepository.countByQuizSetIdIn(quizSetIds).stream()
                        .collect(Collectors.toMap(QuizSetQuestionCount::getQuizSetId, QuizSetQuestionCount::getCount));

        return attempts.stream()
                .map(a -> {
                    QuizSet quizSet = a.getQuizSet();
                    Integer totalQuestions = quizSet != null
                            ? questionCountByQuizSetId.getOrDefault(quizSet.getQuizSetId(), 0L).intValue()
                            : a.getUserAnswers().size(); // 가상 세션은 문제 수를 직접 센다
                    return QuizAttemptResponse.builder()
                        .attemptId(a.getAttemptId())
                        .quizSetId(quizSet != null ? quizSet.getQuizSetId() : null)
                        .courseId(quizSet != null && quizSet.getCourse() != null ? quizSet.getCourse().getCourseId() : null)
                        .quizTitle(quizSet != null ? quizSet.getTitle() : "오답 복습")
                        .score(a.getScore())
                        .totalQuestions(totalQuestions)
                        .createdAt(a.getStartTime() != null ? a.getStartTime() : LocalDateTime.now()) // Null 방어
                        .build();
                })
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt())) // 안전한 정렬
                .collect(Collectors.toList());
    }

    private void validateOwnership(Student owner, Student requester, String message) {
        if (!owner.getStudId().equals(requester.getStudId())) {
            throw new CourseAccessException(message);
        }
    }

    // AI 퀴즈 생성에 사용할 노트가 전부 존재하고 요청 학생 본인 소유인지 확인한다.
    // (노트 소유권은 생성 시점에 이미 수강 여부를 검증받았으므로 별도 수강 확인은 필요 없다.)
    private void validateNoteAccess(List<Long> requestedNoteIds, List<Note> notes, Student student) {
        if (notes.size() != requestedNoteIds.size()) {
            throw new InvalidRequestException("존재하지 않는 노트가 포함되어 있습니다.");
        }
        for (Note note : notes) {
            validateOwnership(note.getStudent(), student, "본인 노트만 퀴즈 생성에 사용할 수 있습니다.");
        }
        validateSameCourse(notes);
    }

    // 첫 번째 노트의 강의를 기준으로, 요청된 노트가 모두 같은 강의에 속하는지 확인한다.
    // QuizSet.course는 notes.get(0)의 강의로 설정되므로(generateQuiz), 다른 강의 노트가
    // 섞이면 그 사실이 QuizSet.course에 드러나지 않은 채 조용히 유실된다.
    private void validateSameCourse(List<Note> notes) {
        Long firstCourseId = notes.get(0).getCourse().getCourseId();
        boolean mixedCourses = notes.stream()
                .anyMatch(note -> !note.getCourse().getCourseId().equals(firstCourseId));
        if (mixedCourses) {
            throw new InvalidRequestException("서로 다른 강의의 노트를 한 번에 퀴즈로 생성할 수 없습니다.");
        }
    }
}
