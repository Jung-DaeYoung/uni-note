package com.uninote.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uninote.backend.domain.*;
import com.uninote.backend.dto.*;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.exception.ExternalServiceException;
import com.uninote.backend.exception.InvalidRequestException;
import com.uninote.backend.exception.ResourceNotFoundException;
import com.uninote.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuizService {
    // AI 요청 폭주/오남용을 막기 위한 최소한의 상한선. 실제 UI는 이보다 훨씬 적은 수를
    // 기본값으로 쓰지만, 클라이언트가 값을 임의로 조작해 보낼 수 있으므로 서버에서도 제한한다.
    private static final int MAX_NOTES_PER_QUIZ = 20;
    private static final int MAX_QUESTIONS_PER_TYPE = 20;
    private static final int MAX_TOTAL_QUESTIONS = 30;

    private final NoteRepository noteRepository;
    private final QuizSetRepository quizSetRepository;
    private final QuizAttemptRepository quizAttemptRepository;
    private final UserAnswerRepository userAnswerRepository;
    private final QuestionRepository questionRepository;
    private final ObjectMapper objectMapper;
    private final QuizAiGenerationService quizAiGenerationService;
    private final QuestionResponseMapper questionResponseMapper;

    @Transactional
    public QuizResponse generateQuiz(QuizRequest request, Student student) {
        List<Note> notes = noteRepository.findAllById(request.getNoteIds());
        validateNoteAccess(request.getNoteIds(), notes, student);
        validateGenerationLimits(request, notes);

        QuizResponse quizResponse = quizAiGenerationService.generateQuizContent(request, notes, student);

        if (!quizResponse.getQuestions().isEmpty()) {
            QuizSet quizSet = new QuizSet();
            quizSet.setTitle(quizResponse.getTitle());
            quizSet.setDifficulty(request.getDifficulty());
            quizSet.setSourceNotes(writeJson(request.getNoteIds()));
            quizSet.setStudent(student);

            if (!notes.isEmpty()) {
                quizSet.setCourse(notes.get(0).getCourse());
            }

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
        }
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

        Map<QuestionType, Integer> typeCounts = request.getTypeCounts();
        if (typeCounts == null || typeCounts.isEmpty()) {
            throw new InvalidRequestException("생성할 문제 유형과 개수를 지정해야 합니다.");
        }

        int total = 0;
        for (Integer count : typeCounts.values()) {
            if (count == null || count < 1 || count > MAX_QUESTIONS_PER_TYPE) {
                throw new InvalidRequestException("문제 유형별 개수는 1~" + MAX_QUESTIONS_PER_TYPE + " 사이여야 합니다.");
            }
            total += count;
        }
        if (total > MAX_TOTAL_QUESTIONS) {
            throw new InvalidRequestException("한 번에 생성할 수 있는 총 문제 수는 최대 " + MAX_TOTAL_QUESTIONS + "개입니다.");
        }
    }

    @Transactional
    public void deleteQuiz(Long quizSetId, Student student) {
        QuizSet quizSet = quizSetRepository.findById(quizSetId)
            .orElseThrow(() -> new ResourceNotFoundException("퀴즈를 찾을 수 없습니다."));

        validateOwnership(quizSet.getStudent(), student, "본인 퀴즈만 삭제할 수 있습니다.");

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

    @Transactional
    public void saveAttempt(QuizAttemptRequest request, Student student) {
        QuizSet quizSet = quizSetRepository.findById(request.getQuizSetId())
            .orElseThrow(() -> new ResourceNotFoundException("퀴즈를 찾을 수 없습니다."));

        // 제출된 답안을 서버가 직접 채점한다. 클라이언트가 보낸 score/isCorrect는 신뢰하지 않는다.
        List<UserAnswer> gradedAnswers = new ArrayList<>();
        int correctCount = 0;
        for (QuizAttemptRequest.UserAnswerRequest uar : request.getUserAnswers()) {
            Question question = questionRepository.findById(uar.getQuestionId())
                .orElseThrow(() -> new ResourceNotFoundException("문제를 찾을 수 없습니다."));

            if (!question.getQuizSet().getQuizSetId().equals(quizSet.getQuizSetId())) {
                throw new InvalidRequestException("해당 퀴즈에 속하지 않는 문제입니다.");
            }

            boolean isCorrect = isAnswerCorrect(uar.getSubmittedAnswer(), question.getCorrectAnswer());
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
        attempt.setQuizSet(quizSet);
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

    // 프론트(CBTPlayer.jsx)와 동일한 대소문자 무시·공백 제거 비교로 정답 여부를 판정한다.
    private boolean isAnswerCorrect(String submittedAnswer, String correctAnswer) {
        String submitted = submittedAnswer == null ? "" : submittedAnswer.trim().toLowerCase();
        String correct = correctAnswer == null ? "" : correctAnswer.trim().toLowerCase();
        return submitted.equals(correct);
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

        return QuizAttemptDetailResponse.builder()
            .attemptId(attempt.getAttemptId())
            .quizSetId(attempt.getQuizSet().getQuizSetId())
            .courseId(attempt.getQuizSet().getCourse() != null ? attempt.getQuizSet().getCourse().getCourseId() : null)
            .quizTitle(attempt.getQuizSet().getTitle())
            .difficulty(attempt.getQuizSet().getDifficulty() != null ? attempt.getQuizSet().getDifficulty().name() : "NORMAL")
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
                .map(a -> a.getQuizSet().getQuizSetId())
                .distinct()
                .collect(Collectors.toList());
        Map<Long, Long> questionCountByQuizSetId = quizSetIds.isEmpty()
                ? Map.of()
                : questionRepository.countByQuizSetIdIn(quizSetIds).stream()
                        .collect(Collectors.toMap(QuizSetQuestionCount::getQuizSetId, QuizSetQuestionCount::getCount));

        return attempts.stream()
                .map(a -> QuizAttemptResponse.builder()
                    .attemptId(a.getAttemptId())
                    .quizSetId(a.getQuizSet().getQuizSetId())
                    .courseId(a.getQuizSet().getCourse() != null ? a.getQuizSet().getCourse().getCourseId() : null)
                    .quizTitle(a.getQuizSet().getTitle())
                    .score(a.getScore())
                    .totalQuestions(questionCountByQuizSetId.getOrDefault(a.getQuizSet().getQuizSetId(), 0L).intValue())
                    .createdAt(a.getStartTime() != null ? a.getStartTime() : LocalDateTime.now()) // Null 방어
                    .build())
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
        if (notes.isEmpty()) {
            return;
        }
        Long firstCourseId = notes.get(0).getCourse().getCourseId();
        boolean mixedCourses = notes.stream()
                .anyMatch(note -> !note.getCourse().getCourseId().equals(firstCourseId));
        if (mixedCourses) {
            throw new InvalidRequestException("서로 다른 강의의 노트를 한 번에 퀴즈로 생성할 수 없습니다.");
        }
    }
}
