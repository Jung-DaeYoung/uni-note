package com.uninote.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uninote.backend.domain.*;
import com.uninote.backend.dto.*;
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

        try {
            QuizResponse quizResponse = quizAiGenerationService.generateQuizContent(request, notes);

            if (!quizResponse.getQuestions().isEmpty()) {
                QuizSet quizSet = new QuizSet();
                quizSet.setTitle(quizResponse.getTitle());
                quizSet.setDifficulty(request.getDifficulty());
                quizSet.setSourceNotes(objectMapper.writeValueAsString(request.getNoteIds()));
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
                    question.setOptions(objectMapper.writeValueAsString(qr.getOptions()));
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
        } catch (Exception e) {
            log.error("AI 퀴즈 처리 실패", e);
            throw new RuntimeException("퀴즈 생성 실패: " + e.getMessage());
        }
    }

    @Transactional
    public void deleteQuiz(Long quizSetId, Student student) {
        QuizSet quizSet = quizSetRepository.findById(quizSetId)
            .orElseThrow(() -> new RuntimeException("퀴즈를 찾을 수 없습니다."));

        if (!quizSet.getStudent().getStudId().equals(student.getStudId())) {
            throw new RuntimeException("삭제 권한이 없습니다.");
        }

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
    public QuizSetDetailResponse getQuizDetail(Long quizSetId) {
        QuizSet quizSet = quizSetRepository.findById(quizSetId)
            .orElseThrow(() -> new RuntimeException("퀴즈를 찾을 수 없습니다."));

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
            .orElseThrow(() -> new RuntimeException("퀴즈를 찾을 수 없습니다."));

        QuizAttempt attempt = new QuizAttempt();
        attempt.setQuizSet(quizSet);
        attempt.setStudent(student);
        attempt.setScore(request.getScore());
        attempt.setStatus(QuizStatus.COMPLETED);
        attempt.setStartTime(LocalDateTime.now()); // 수동 설정
        attempt.setEndTime(LocalDateTime.now());

        quizAttemptRepository.save(attempt);

        for (QuizAttemptRequest.UserAnswerRequest uar : request.getUserAnswers()) {
            Question question = questionRepository.findById(uar.getQuestionId())
                .orElseThrow(() -> new RuntimeException("문제를 찾을 수 없습니다."));

            UserAnswer userAnswer = new UserAnswer();
            userAnswer.setQuizAttempt(attempt);
            userAnswer.setQuestion(question);
            userAnswer.setSubmittedAnswer(uar.getSubmittedAnswer());
            userAnswer.setIsCorrect(uar.getIsCorrect());
            userAnswerRepository.save(userAnswer);
        }
    }

    @Transactional(readOnly = true)
    public List<QuizAttemptResponse> getMyAttempts(Student student) {
        return quizAttemptRepository.findByStudent_StudId(student.getStudId()).stream()
            .map(a -> QuizAttemptResponse.builder()
                .attemptId(a.getAttemptId())
                .quizSetId(a.getQuizSet().getQuizSetId())
                .courseId(a.getQuizSet().getCourse() != null ? a.getQuizSet().getCourse().getCourseId() : null)
                .quizTitle(a.getQuizSet().getTitle())
                .score(a.getScore())
                .totalQuestions(a.getQuizSet().getQuestions() != null ? a.getQuizSet().getQuestions().size() : 0)
                .createdAt(a.getStartTime() != null ? a.getStartTime() : LocalDateTime.now()) // Null 방어
                .build())
            .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt())) // 안전한 정렬
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public QuizAttemptDetailResponse getAttemptDetail(Long attemptId) {
        QuizAttempt attempt = quizAttemptRepository.findById(attemptId)
            .orElseThrow(() -> new RuntimeException("기록을 찾을 수 없습니다."));

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
        return quizAttemptRepository.findByQuizSet_QuizSetIdAndStudent_StudId(quizSetId, student.getStudId()).stream()
            .map(a -> QuizAttemptResponse.builder()
                .attemptId(a.getAttemptId())
                .quizSetId(a.getQuizSet().getQuizSetId())
                .courseId(a.getQuizSet().getCourse() != null ? a.getQuizSet().getCourse().getCourseId() : null)
                .quizTitle(a.getQuizSet().getTitle())
                .score(a.getScore())
                .totalQuestions(a.getQuizSet().getQuestions() != null ? a.getQuizSet().getQuestions().size() : 0)
                .createdAt(a.getStartTime() != null ? a.getStartTime() : LocalDateTime.now())
                .build())
            .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
            .collect(Collectors.toList());
    }
}
