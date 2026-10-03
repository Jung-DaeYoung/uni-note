package com.uninote.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uninote.backend.domain.Course;
import com.uninote.backend.domain.Note;
import com.uninote.backend.domain.Question;
import com.uninote.backend.domain.QuizAttempt;
import com.uninote.backend.domain.QuizDifficulty;
import com.uninote.backend.domain.QuestionType;
import com.uninote.backend.domain.QuizSet;
import com.uninote.backend.domain.Student;
import com.uninote.backend.domain.UserAnswer;
import com.uninote.backend.dto.QuestionResponse;
import com.uninote.backend.dto.QuizAttemptRequest;
import com.uninote.backend.dto.QuizAttemptResponse;
import com.uninote.backend.dto.QuizRequest;
import com.uninote.backend.dto.QuizResponse;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.exception.ExternalServiceException;
import com.uninote.backend.exception.InvalidRequestException;
import com.uninote.backend.exception.TooManyRequestsException;
import com.uninote.backend.exception.ResourceNotFoundException;
import com.uninote.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

// OutputCaptureExtension: 생성 결과 로그(quiz.generation) 검증용
@ExtendWith(OutputCaptureExtension.class)
class QuizServiceTest {

    private final NoteRepository noteRepository = mock(NoteRepository.class);
    private final QuizSetRepository quizSetRepository = mock(QuizSetRepository.class);
    private final QuizAttemptRepository quizAttemptRepository = mock(QuizAttemptRepository.class);
    private final UserAnswerRepository userAnswerRepository = mock(UserAnswerRepository.class);
    private final QuestionRepository questionRepository = mock(QuestionRepository.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final QuizAiGenerationService quizAiGenerationService = mock(QuizAiGenerationService.class);
    private final QuestionResponseMapper questionResponseMapper = mock(QuestionResponseMapper.class);
    private final IncorrectNoteItemRepository incorrectNoteItemRepository = mock(IncorrectNoteItemRepository.class);
    // 실제 검증 로직을 함께 확인하기 위해 mock이 아닌 실제 객체를 쓴다.
    private final QuizQualityValidator quizQualityValidator = new QuizQualityValidator();
    // 트랜잭션 경계만 흉내 낸다(mock 트랜잭션 매니저 위에서 콜백이 그대로 실행된다).
    private final TransactionTemplate transactionTemplate = new TransactionTemplate(mock(PlatformTransactionManager.class));
    private final Clock clock = mock(Clock.class);

    private final QuizService quizService = new QuizService(
            noteRepository, quizSetRepository, quizAttemptRepository, userAnswerRepository,
            questionRepository, objectMapper, quizAiGenerationService, questionResponseMapper,
            incorrectNoteItemRepository, quizQualityValidator, transactionTemplate, clock);

    // note 10L의 블록 b1에서 추출된 입력 (출처 허용 집합: 10L -> {b1})
    private final QuizGenerationInput textInput =
            new QuizGenerationInput("[[REF:10/b1]] 페이지 교체 ", List.of(), Map.of(10L, Set.of("b1")));

    private Student owner;
    private Student other;
    private Course course;
    private Course anotherCourse;
    private QuizSet quizSet;
    private QuizAttempt attempt;

    @BeforeEach
    void setUp() {
        owner = new Student();
        owner.setStudId(1L);
        owner.setStudentNum("owner-num");

        other = new Student();
        other.setStudId(2L);
        other.setStudentNum("other-num");

        course = new Course();
        course.setCourseId(10L);

        anotherCourse = new Course();
        anotherCourse.setCourseId(20L);

        quizSet = new QuizSet();
        quizSet.setQuizSetId(50L);
        quizSet.setStudent(owner);
        quizSet.setTitle("퀴즈");
        quizSet.setQuestions(Collections.emptyList());

        attempt = new QuizAttempt();
        attempt.setAttemptId(70L);
        attempt.setStudent(owner);
        attempt.setQuizSet(quizSet);
        attempt.setUserAnswers(Collections.emptyList());

        when(clock.instant()).thenReturn(Instant.EPOCH);
        when(questionRepository.save(any(Question.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private Note ownedNote(long noteId) {
        Note note = new Note();
        note.setNoteId(noteId);
        note.setStudent(owner);
        note.setCourse(course);
        return note;
    }

    private QuizRequest requestFor(List<Long> noteIds, Map<QuestionType, Integer> typeCounts) {
        QuizRequest request = new QuizRequest();
        request.setNoteIds(noteIds);
        request.setTypeCounts(typeCounts);
        request.setDifficulty(QuizDifficulty.NORMAL);
        return request;
    }

    private QuestionResponse multipleChoice(String text, String answer) {
        QuestionResponse q = new QuestionResponse();
        q.setType(QuestionType.MULTIPLE_CHOICE);
        q.setQuestionText(text);
        q.setOptions(List.of("LRU", "FIFO", "OPT"));
        q.setCorrectAnswer(answer);
        q.setSourceNoteId(10L);
        q.setSourceBlockId("b1");
        return q;
    }

    private QuizResponse aiResponseWith(QuestionResponse... questions) {
        QuizResponse response = new QuizResponse();
        response.setTitle("페이지 교체 퀴즈");
        response.setQuestions(new java.util.ArrayList<>(List.of(questions)));
        return response;
    }

    @Test
    void ownerCanGetOwnQuizDetail() {
        when(quizSetRepository.findById(50L)).thenReturn(Optional.of(quizSet));

        var response = quizService.getQuizDetail(50L, owner);

        assertThat(response.getQuizSetId()).isEqualTo(50L);
    }

    @Test
    void otherStudentCannotGetSomeoneElsesQuizDetail() {
        when(quizSetRepository.findById(50L)).thenReturn(Optional.of(quizSet));

        assertThatThrownBy(() -> quizService.getQuizDetail(50L, other))
                .isInstanceOf(CourseAccessException.class);
    }

    @Test
    void ownerCanGetOwnAttemptDetail() {
        when(quizAttemptRepository.findById(70L)).thenReturn(Optional.of(attempt));

        var response = quizService.getAttemptDetail(70L, owner);

        assertThat(response.getAttemptId()).isEqualTo(70L);
    }

    @Test
    void otherStudentCannotGetSomeoneElsesAttemptDetail() {
        when(quizAttemptRepository.findById(70L)).thenReturn(Optional.of(attempt));

        assertThatThrownBy(() -> quizService.getAttemptDetail(70L, other))
                .isInstanceOf(CourseAccessException.class);
    }

    @Test
    void saveAttemptNormalizesShortAnswerSpacesAndEdgePunctuationOnly() {
        // [유형, 정답, 제출, 기대 정답 여부]
        Object[][] cases = {
                {QuestionType.SHORT_ANSWER, "운영체제", "운영 체제.", true},
                {QuestionType.SHORT_ANSWER, "LRU", "  \"lru!\" ", true},
                {QuestionType.SHORT_ANSWER, "C++", "c++", true},
                {QuestionType.SHORT_ANSWER, "C++", "C", false},
                {QuestionType.SHORT_ANSWER, "페이지 폴트", "페이지 교체", false},
                {QuestionType.SHORT_ANSWER, "LRU", null, false},
                // 객관식은 기존 trim + 소문자만: 안쪽 공백이 다르면 다른 보기다.
                {QuestionType.MULTIPLE_CHOICE, "Least Recently Used", " least recently used ", true},
                {QuestionType.MULTIPLE_CHOICE, "Least Recently Used", "LeastRecentlyUsed", false},
        };
        when(quizSetRepository.findById(50L)).thenReturn(Optional.of(quizSet));
        List<QuizAttemptRequest.UserAnswerRequest> answers = new java.util.ArrayList<>();
        for (int i = 0; i < cases.length; i++) {
            long id = i + 1;
            Question q = new Question();
            q.setQuestionId(id);
            q.setQuizSet(quizSet);
            q.setType((QuestionType) cases[i][0]);
            q.setCorrectAnswer((String) cases[i][1]);
            when(questionRepository.findById(id)).thenReturn(Optional.of(q));
            QuizAttemptRequest.UserAnswerRequest answer = new QuizAttemptRequest.UserAnswerRequest();
            answer.setQuestionId(id);
            answer.setSubmittedAnswer((String) cases[i][2]);
            answers.add(answer);
        }
        QuizAttemptRequest request = new QuizAttemptRequest();
        request.setQuizSetId(50L);
        request.setUserAnswers(answers);

        quizService.saveAttempt(request, owner);

        ArgumentCaptor<UserAnswer> captor = ArgumentCaptor.forClass(UserAnswer.class);
        verify(userAnswerRepository, times(cases.length)).save(captor.capture());
        for (int i = 0; i < cases.length; i++) {
            assertThat(captor.getAllValues().get(i).getIsCorrect()).as("case %d", i).isEqualTo(cases[i][3]);
        }
    }

    @Test
    void saveAttemptGradesServerSideFromActualAnswers() {
        // QuizAttemptRequest에는 score/isCorrect 입력 필드 자체가 없다(API 계약에서 제거됨).
        // 서버는 오직 submittedAnswer와 문제의 correctAnswer만으로 정답 여부와 점수를 계산한다.
        Question correctQuestion = new Question();
        correctQuestion.setQuestionId(1L);
        correctQuestion.setQuizSet(quizSet);
        correctQuestion.setCorrectAnswer("Paris");

        Question wrongQuestion = new Question();
        wrongQuestion.setQuestionId(2L);
        wrongQuestion.setQuizSet(quizSet);
        wrongQuestion.setCorrectAnswer("London");

        when(quizSetRepository.findById(50L)).thenReturn(Optional.of(quizSet));
        when(questionRepository.findById(1L)).thenReturn(Optional.of(correctQuestion));
        when(questionRepository.findById(2L)).thenReturn(Optional.of(wrongQuestion));

        QuizAttemptRequest.UserAnswerRequest answer1 = new QuizAttemptRequest.UserAnswerRequest();
        answer1.setQuestionId(1L);
        answer1.setSubmittedAnswer("  paris "); // 대소문자/공백만 다름 -> 실제로는 정답

        QuizAttemptRequest.UserAnswerRequest answer2 = new QuizAttemptRequest.UserAnswerRequest();
        answer2.setQuestionId(2L);
        answer2.setSubmittedAnswer("berlin"); // 실제 오답

        QuizAttemptRequest request = new QuizAttemptRequest();
        request.setQuizSetId(50L);
        request.setUserAnswers(List.of(answer1, answer2));

        quizService.saveAttempt(request, owner);

        ArgumentCaptor<QuizAttempt> attemptCaptor = ArgumentCaptor.forClass(QuizAttempt.class);
        verify(quizAttemptRepository).save(attemptCaptor.capture());
        assertThat(attemptCaptor.getValue().getScore()).isEqualTo(1); // 서버가 계산한 정답 1개

        ArgumentCaptor<UserAnswer> userAnswerCaptor = ArgumentCaptor.forClass(UserAnswer.class);
        verify(userAnswerRepository, times(2)).save(userAnswerCaptor.capture());
        List<UserAnswer> saved = userAnswerCaptor.getAllValues();
        assertThat(saved.get(0).getIsCorrect()).isTrue();
        assertThat(saved.get(1).getIsCorrect()).isFalse();
    }

    @Test
    void saveAttemptRejectsQuestionThatDoesNotBelongToTheQuizSet() {
        QuizSet anotherQuizSet = new QuizSet();
        anotherQuizSet.setQuizSetId(999L);

        Question foreignQuestion = new Question();
        foreignQuestion.setQuestionId(3L);
        foreignQuestion.setQuizSet(anotherQuizSet); // 다른 퀴즈에 속한 문제
        foreignQuestion.setCorrectAnswer("X");

        when(quizSetRepository.findById(50L)).thenReturn(Optional.of(quizSet));
        when(questionRepository.findById(3L)).thenReturn(Optional.of(foreignQuestion));

        QuizAttemptRequest.UserAnswerRequest answer = new QuizAttemptRequest.UserAnswerRequest();
        answer.setQuestionId(3L);
        answer.setSubmittedAnswer("X");

        QuizAttemptRequest request = new QuizAttemptRequest();
        request.setQuizSetId(50L);
        request.setUserAnswers(List.of(answer));

        assertThatThrownBy(() -> quizService.saveAttempt(request, owner))
                .isInstanceOf(InvalidRequestException.class);

        verify(quizAttemptRepository, never()).save(any());
        verify(userAnswerRepository, never()).save(any());
    }

    @Test
    void saveAttemptPersistsVirtualSessionWithNullQuizSetWhenQuizSetIdIsSentinel() {
        // 오답노트 재풀이/오늘의 복습은 IncorrectNoteService.getPracticeSession()이 반환하는
        // quizSetId(-1L) 관례를 그대로 사용한다 — 이전에는 quizSetRepository.findById(-1L)이
        // 404를 던졌고 프론트가 그 오류를 조용히 삼켜 풀이 결과가 전혀 저장되지 않았다.
        Question question = new Question();
        question.setQuestionId(5L);
        question.setQuizSet(quizSet); // quizSet.student == owner
        question.setCorrectAnswer("A");
        when(questionRepository.findById(5L)).thenReturn(Optional.of(question));

        QuizAttemptRequest.UserAnswerRequest answer = new QuizAttemptRequest.UserAnswerRequest();
        answer.setQuestionId(5L);
        answer.setSubmittedAnswer("A");

        QuizAttemptRequest request = new QuizAttemptRequest();
        request.setQuizSetId(-1L);
        request.setUserAnswers(List.of(answer));

        quizService.saveAttempt(request, owner);

        ArgumentCaptor<QuizAttempt> attemptCaptor = ArgumentCaptor.forClass(QuizAttempt.class);
        verify(quizAttemptRepository).save(attemptCaptor.capture());
        assertThat(attemptCaptor.getValue().getQuizSet()).isNull();
        assertThat(attemptCaptor.getValue().getScore()).isEqualTo(1);
        verify(userAnswerRepository).save(any());
        verify(quizSetRepository, never()).findById(any());
    }

    @Test
    void saveAttemptRejectsVirtualSessionQuestionOwnedByAnotherStudent() {
        QuizSet othersQuizSet = new QuizSet();
        othersQuizSet.setQuizSetId(60L);
        othersQuizSet.setStudent(other);

        Question othersQuestion = new Question();
        othersQuestion.setQuestionId(6L);
        othersQuestion.setQuizSet(othersQuizSet);
        othersQuestion.setCorrectAnswer("A");
        when(questionRepository.findById(6L)).thenReturn(Optional.of(othersQuestion));

        QuizAttemptRequest.UserAnswerRequest answer = new QuizAttemptRequest.UserAnswerRequest();
        answer.setQuestionId(6L);
        answer.setSubmittedAnswer("A");

        QuizAttemptRequest request = new QuizAttemptRequest();
        request.setQuizSetId(-1L);
        request.setUserAnswers(List.of(answer));

        assertThatThrownBy(() -> quizService.saveAttempt(request, owner))
                .isInstanceOf(CourseAccessException.class);

        verify(quizAttemptRepository, never()).save(any());
    }

    @Test
    void saveAttemptRejectsNamedQuizSetOwnedByAnotherStudent() {
        QuizSet othersQuizSet = new QuizSet();
        othersQuizSet.setQuizSetId(50L);
        othersQuizSet.setStudent(other);
        when(quizSetRepository.findById(50L)).thenReturn(Optional.of(othersQuizSet));

        QuizAttemptRequest.UserAnswerRequest answer = new QuizAttemptRequest.UserAnswerRequest();
        answer.setQuestionId(7L);
        answer.setSubmittedAnswer("A");

        QuizAttemptRequest request = new QuizAttemptRequest();
        request.setQuizSetId(50L);
        request.setUserAnswers(List.of(answer));

        assertThatThrownBy(() -> quizService.saveAttempt(request, owner))
                .isInstanceOf(CourseAccessException.class);

        verify(quizAttemptRepository, never()).save(any());
        verifyNoInteractions(questionRepository);
    }

    @Test
    void getMyAttemptsHandlesNullQuizSetGracefully() {
        UserAnswer ua1 = new UserAnswer();
        UserAnswer ua2 = new UserAnswer();
        attempt.setQuizSet(null); // 가상 세션(오답 복습) 기록
        attempt.setUserAnswers(List.of(ua1, ua2));

        when(quizAttemptRepository.findByStudent_StudId(owner.getStudId())).thenReturn(List.of(attempt));

        List<QuizAttemptResponse> responses = quizService.getMyAttempts(owner);

        assertThat(responses).hasSize(1);
        QuizAttemptResponse response = responses.get(0);
        assertThat(response.getQuizSetId()).isNull();
        assertThat(response.getCourseId()).isNull();
        assertThat(response.getQuizTitle()).isEqualTo("오답 복습");
        assertThat(response.getTotalQuestions()).isEqualTo(2);
        verifyNoInteractions(questionRepository);
    }

    @Test
    void getAttemptDetailHandlesNullQuizSetGracefully() {
        attempt.setQuizSet(null);

        when(quizAttemptRepository.findById(70L)).thenReturn(Optional.of(attempt));

        var response = quizService.getAttemptDetail(70L, owner);

        assertThat(response.getQuizSetId()).isNull();
        assertThat(response.getCourseId()).isNull();
        assertThat(response.getQuizTitle()).isEqualTo("오답 복습");
        assertThat(response.getDifficulty()).isEqualTo("NORMAL");
    }

    @Test
    void getQuizDetailThrowsResourceNotFoundWhenQuizSetDoesNotExist() {
        when(quizSetRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> quizService.getQuizDetail(999L, owner))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void generateQuizSucceedsWhenAllNotesAreOwnedByRequester() throws Exception {
        Note note = ownedNote(10L);
        when(noteRepository.findAllById(List.of(10L))).thenReturn(List.of(note));
        when(quizAiGenerationService.prepareInput(eq(List.of(note)), eq(owner), eq(Map.of()))).thenReturn(textInput);
        QuizResponse aiResponse = aiResponseWith(multipleChoice("가장 오래 사용되지 않은 페이지를 교체하는 알고리즘은?", "lru"));
        QuizRequest request = requestFor(List.of(10L), Map.of(QuestionType.MULTIPLE_CHOICE, 1));
        when(quizAiGenerationService.requestQuiz(request, textInput)).thenReturn(aiResponse);

        QuizResponse response = quizService.generateQuiz(request, owner);

        assertThat(response).isSameAs(aiResponse);
        // 정답은 대소문자가 달라도 보기 원문으로 치환되어 저장된다.
        ArgumentCaptor<Question> saved = ArgumentCaptor.forClass(Question.class);
        verify(questionRepository).save(saved.capture());
        assertThat(saved.getValue().getCorrectAnswer()).isEqualTo("LRU");
        assertThat(saved.getValue().getSourceBlockId()).isEqualTo("b1");
        verify(quizSetRepository).save(any(QuizSet.class));
    }

    @Test
    void generateQuizRejectsWhenANoteBelongsToAnotherStudent() throws Exception {
        Note ownNote = new Note();
        ownNote.setNoteId(10L);
        ownNote.setStudent(owner);

        Note someoneElsesNote = new Note();
        someoneElsesNote.setNoteId(11L);
        someoneElsesNote.setStudent(other);

        when(noteRepository.findAllById(List.of(10L, 11L))).thenReturn(List.of(ownNote, someoneElsesNote));

        QuizRequest request = new QuizRequest();
        request.setNoteIds(List.of(10L, 11L));

        assertThatThrownBy(() -> quizService.generateQuiz(request, owner))
                .isInstanceOf(CourseAccessException.class);

        verifyNoInteractions(quizAiGenerationService);
    }

    @Test
    void generateQuizSucceedsWhenAllNotesBelongToTheSameCourse() throws Exception {
        Note note1 = ownedNote(10L);
        Note note2 = ownedNote(11L);
        when(noteRepository.findAllById(List.of(10L, 11L))).thenReturn(List.of(note1, note2));
        when(quizAiGenerationService.prepareInput(any(), any(), any())).thenReturn(textInput);
        QuizResponse aiResponse = aiResponseWith(multipleChoice("페이지 교체 알고리즘은?", "LRU"));
        when(quizAiGenerationService.requestQuiz(any(), any())).thenReturn(aiResponse);

        QuizRequest request = requestFor(List.of(10L, 11L), Map.of(QuestionType.MULTIPLE_CHOICE, 1));

        QuizResponse response = quizService.generateQuiz(request, owner);

        assertThat(response).isSameAs(aiResponse);
    }

    @Test
    void generateQuizRejectsEmptyNoteContentWithoutCallingAi() {
        Note note = ownedNote(10L);
        when(noteRepository.findAllById(List.of(10L))).thenReturn(List.of(note));
        when(quizAiGenerationService.prepareInput(any(), any(), any()))
                .thenReturn(new QuizGenerationInput("  ", List.of(), Map.of()));

        QuizRequest request = requestFor(List.of(10L), Map.of(QuestionType.MULTIPLE_CHOICE, 1));

        assertThatThrownBy(() -> quizService.generateQuiz(request, owner))
                .isInstanceOf(InvalidRequestException.class);
        verify(quizAiGenerationService, never()).requestQuiz(any(), any());
        verify(quizSetRepository, never()).save(any());
    }

    @Test
    void generateQuizRejectsTooLongInputTextWithoutCallingAi(CapturedOutput output) {
        Note note = ownedNote(10L);
        when(noteRepository.findAllById(List.of(10L))).thenReturn(List.of(note));
        when(quizAiGenerationService.prepareInput(any(), any(), any()))
                .thenReturn(new QuizGenerationInput("가".repeat(QuizService.MAX_INPUT_TEXT_CHARS + 1), List.of(), Map.of()));

        QuizRequest request = requestFor(List.of(10L), Map.of(QuestionType.MULTIPLE_CHOICE, 1));

        assertThatThrownBy(() -> quizService.generateQuiz(request, owner))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("노트 내용이 너무 깁니다");
        assertThat(output.getOut()).contains("quiz.generation status=REJECTED_TOO_LONG textChars="
                + (QuizService.MAX_INPUT_TEXT_CHARS + 1) + " studId=1");
        verify(quizAiGenerationService, never()).requestQuiz(any(), any());
        verify(quizSetRepository, never()).save(any());
    }

    // AI 호출이 실패하도록 두고(저장 경로 없이) 같은 학생으로 호출 제한만 확인한다.
    private QuizRequest stubFailingAiCallFor(Student student, long noteId) {
        Note note = ownedNote(noteId);
        note.setStudent(student);
        when(noteRepository.findAllById(List.of(noteId))).thenReturn(List.of(note));
        when(quizAiGenerationService.prepareInput(any(), any(), any())).thenReturn(textInput);
        // 다시 스텁해도 기존 스텁이 실행되지 않도록 doThrow 형태로 쓴다.
        doThrow(new ExternalServiceException("AI 퀴즈 생성 서비스에 연결할 수 없습니다."))
                .when(quizAiGenerationService).requestQuiz(any(), any());
        return requestFor(List.of(noteId), Map.of(QuestionType.MULTIPLE_CHOICE, 1));
    }

    private void generateUntilFailure(QuizRequest request, Student student, int times) {
        for (int i = 0; i < times; i++) {
            assertThatThrownBy(() -> quizService.generateQuiz(request, student))
                    .isInstanceOf(ExternalServiceException.class);
        }
    }

    @Test
    void generateQuizRejectsSixthCallInWindowWithoutCallingAi(CapturedOutput output) {
        QuizRequest request = stubFailingAiCallFor(owner, 10L);
        // AI 호출 실패도 횟수에 포함되고, 실패 후 진행 중 상태가 풀려 다음 요청이 동시 생성 제한에 걸리지 않는다.
        generateUntilFailure(request, owner, QuizService.MAX_GENERATIONS_PER_WINDOW);

        assertThatThrownBy(() -> quizService.generateQuiz(request, owner))
                .isInstanceOf(TooManyRequestsException.class)
                .hasMessage("문제 생성은 10분에 5회까지 할 수 있습니다. 10분 후 다시 시도해 주세요.");
        verify(quizAiGenerationService, times(QuizService.MAX_GENERATIONS_PER_WINDOW)).requestQuiz(any(), any());
        assertThat(output.getOut()).contains("quiz.generation status=RATE_LIMITED reason=WINDOW studId=1");
    }

    @Test
    void generateQuizAllowsAgainAfterWindowPasses() {
        QuizRequest request = stubFailingAiCallFor(owner, 10L);
        generateUntilFailure(request, owner, QuizService.MAX_GENERATIONS_PER_WINDOW);

        when(clock.instant()).thenReturn(Instant.EPOCH.plus(QuizService.GENERATION_WINDOW));

        generateUntilFailure(request, owner, 1);
    }

    @Test
    void generateQuizRateLimitIsPerStudent() {
        QuizRequest ownerRequest = stubFailingAiCallFor(owner, 10L);
        generateUntilFailure(ownerRequest, owner, QuizService.MAX_GENERATIONS_PER_WINDOW);

        QuizRequest otherRequest = stubFailingAiCallFor(other, 11L);
        generateUntilFailure(otherRequest, other, 1);
    }

    @Test
    void generateQuizInputErrorsDoNotCountTowardRateLimit() {
        Note note = ownedNote(10L);
        when(noteRepository.findAllById(List.of(10L))).thenReturn(List.of(note));
        when(quizAiGenerationService.prepareInput(any(), any(), any()))
                .thenReturn(new QuizGenerationInput("  ", List.of(), Map.of()));
        QuizRequest request = requestFor(List.of(10L), Map.of(QuestionType.MULTIPLE_CHOICE, 1));
        for (int i = 0; i <= QuizService.MAX_GENERATIONS_PER_WINDOW; i++) {
            assertThatThrownBy(() -> quizService.generateQuiz(request, owner))
                    .isInstanceOf(InvalidRequestException.class);
        }

        generateUntilFailure(stubFailingAiCallFor(owner, 10L), owner, 1);
    }

    @Test
    void generateQuizRejectsConcurrentGenerationForSameStudent(CapturedOutput output) {
        QuizRequest request = stubFailingAiCallFor(owner, 10L);
        // 첫 생성이 AI 응답을 기다리는 동안 같은 학생이 다시 요청하는 상황을 재진입으로 만든다.
        doAnswer(inv -> {
            assertThatThrownBy(() -> quizService.generateQuiz(request, owner))
                    .isInstanceOf(TooManyRequestsException.class)
                    .hasMessage("이미 문제를 생성하고 있습니다. 완료된 뒤 다시 시도해 주세요.");
            throw new ExternalServiceException("AI 퀴즈 생성 서비스에 연결할 수 없습니다.");
        }).when(quizAiGenerationService).requestQuiz(any(), any());

        generateUntilFailure(request, owner, 1);
        verify(quizAiGenerationService, times(1)).requestQuiz(any(), any());
        assertThat(output.getOut()).contains("quiz.generation status=RATE_LIMITED reason=CONCURRENT studId=1");
    }

    // 이력 대비 중복(P1-4): 같은 학생·같은 강의(courseId 10)의 이전 문제 문장을 돌려준다.
    private QuizRequest stubHistory(String... previousQuestionTexts) {
        Note note = ownedNote(10L);
        when(noteRepository.findAllById(List.of(10L))).thenReturn(List.of(note));
        when(quizAiGenerationService.prepareInput(any(), any(), any())).thenReturn(textInput);
        when(questionRepository.findRecentQuestionTexts(eq(1L), eq(10L), any()))
                .thenReturn(List.of(previousQuestionTexts));
        return requestFor(List.of(10L), Map.of(QuestionType.MULTIPLE_CHOICE, 1));
    }

    @Test
    void generateQuizSavesWithoutRegenerationWhenNoHistoryDuplicate(CapturedOutput output) {
        QuizRequest request = stubHistory("이전 문제");
        QuizResponse fresh = aiResponseWith(multipleChoice("페이지 교체 알고리즘은?", "LRU"));
        when(quizAiGenerationService.requestQuiz(any(), any())).thenReturn(fresh);

        assertThat(quizService.generateQuiz(request, owner)).isSameAs(fresh);
        verify(quizAiGenerationService, times(1)).requestQuiz(any(), any());
        assertThat(output.getOut()).contains("historyDuplicates=0");
    }

    @Test
    void generateQuizQueriesRecentHistoryOfSameStudentAndCourse() {
        QuizRequest request = stubHistory();
        when(quizAiGenerationService.requestQuiz(any(), any()))
                .thenReturn(aiResponseWith(multipleChoice("페이지 교체 알고리즘은?", "LRU")));

        quizService.generateQuiz(request, owner);

        verify(questionRepository).findRecentQuestionTexts(1L, 10L,
                org.springframework.data.domain.PageRequest.of(0, QuizService.RECENT_QUESTION_HISTORY_SIZE));
    }

    @Test
    void generateQuizRegeneratesOnceWhenResultDuplicatesHistory() {
        // 공백·대소문자만 다른 문장도 중복으로 본다.
        QuizRequest request = stubHistory("  LRU란? ");
        QuizResponse duplicate = aiResponseWith(multipleChoice("lru란?", "LRU"));
        QuizResponse fresh = aiResponseWith(multipleChoice("FIFO란?", "FIFO"));
        when(quizAiGenerationService.requestQuiz(any(), any())).thenReturn(duplicate, fresh);

        assertThat(quizService.generateQuiz(request, owner)).isSameAs(fresh);
        verify(quizAiGenerationService, times(2)).requestQuiz(any(), any());
    }

    @Test
    void generateQuizSavesDuplicateWhenRegeneratedResultAlsoDuplicates(CapturedOutput output) {
        QuizRequest request = stubHistory("LRU란?", "FIFO란?");
        QuizResponse first = aiResponseWith(multipleChoice("LRU란?", "LRU"));
        QuizResponse second = aiResponseWith(multipleChoice("FIFO란?", "FIFO"));
        when(quizAiGenerationService.requestQuiz(any(), any())).thenReturn(first, second);

        // 중복 수가 같으면 앞선 결과를 쓴다. 실패시키지 않는다.
        assertThat(quizService.generateQuiz(request, owner)).isSameAs(first);
        verify(quizAiGenerationService, times(2)).requestQuiz(any(), any());
        assertThat(output.getOut())
                .contains("quiz.generation status=SUCCESS")
                .contains("attempts=2 unverified=0 historyDuplicates=1");
    }

    @Test
    void generateQuizKeepsFirstResultWhenRegeneratedResultFailsValidation() {
        QuizRequest request = stubHistory("LRU란?");
        QuizResponse first = aiResponseWith(multipleChoice("LRU란?", "LRU"));
        when(quizAiGenerationService.requestQuiz(any(), any())).thenReturn(first, aiResponseWith());

        assertThat(quizService.generateQuiz(request, owner)).isSameAs(first);
        verify(quizAiGenerationService, times(2)).requestQuiz(any(), any());
    }

    @Test
    void generateQuizKeepsFirstResultWhenRegenerationAiCallFails() {
        QuizRequest request = stubHistory("LRU란?");
        QuizResponse first = aiResponseWith(multipleChoice("LRU란?", "LRU"));
        when(quizAiGenerationService.requestQuiz(any(), any()))
                .thenReturn(first)
                .thenThrow(new ExternalServiceException("AI 퀴즈 생성 서비스에 연결할 수 없습니다."));

        assertThat(quizService.generateQuiz(request, owner)).isSameAs(first);
        verify(quizAiGenerationService, times(2)).requestQuiz(any(), any());
    }

    @Test
    void generateQuizDoesNotRegenerateDuplicateWhenTimeBudgetExceeded() {
        QuizRequest request = stubHistory("LRU란?");
        QuizResponse first = aiResponseWith(multipleChoice("LRU란?", "LRU"));
        when(quizAiGenerationService.requestQuiz(any(), any())).thenReturn(first);
        when(clock.instant()).thenReturn(Instant.EPOCH, Instant.EPOCH.plusSeconds(31));

        assertThat(quizService.generateQuiz(request, owner)).isSameAs(first);
        verify(quizAiGenerationService, times(1)).requestQuiz(any(), any());
    }

    @Test
    void generateQuizRegeneratesOnceWhenFirstResponseFailsValidation() {
        Note note = ownedNote(10L);
        when(noteRepository.findAllById(List.of(10L))).thenReturn(List.of(note));
        when(quizAiGenerationService.prepareInput(any(), any(), any())).thenReturn(textInput);
        QuizResponse emptyResponse = aiResponseWith();
        QuizResponse validResponse = aiResponseWith(multipleChoice("페이지 교체 알고리즘은?", "LRU"));
        when(quizAiGenerationService.requestQuiz(any(), any())).thenReturn(emptyResponse, validResponse);

        QuizRequest request = requestFor(List.of(10L), Map.of(QuestionType.MULTIPLE_CHOICE, 1));

        QuizResponse response = quizService.generateQuiz(request, owner);

        assertThat(response).isSameAs(validResponse);
        verify(quizAiGenerationService, times(2)).requestQuiz(any(), any());
        // 재생성해도 노트 추출은 한 번만 한다.
        verify(quizAiGenerationService, times(1)).prepareInput(any(), any(), any());
    }

    @Test
    void generateQuizFailsWithoutSavingWhenRegeneratedResponseAlsoFailsValidation() {
        Note note = ownedNote(10L);
        when(noteRepository.findAllById(List.of(10L))).thenReturn(List.of(note));
        when(quizAiGenerationService.prepareInput(any(), any(), any())).thenReturn(textInput);
        when(quizAiGenerationService.requestQuiz(any(), any())).thenReturn(aiResponseWith(), aiResponseWith());

        QuizRequest request = requestFor(List.of(10L), Map.of(QuestionType.MULTIPLE_CHOICE, 1));

        assertThatThrownBy(() -> quizService.generateQuiz(request, owner))
                .isInstanceOf(ExternalServiceException.class)
                .extracting("errorCode").isEqualTo(ExternalServiceException.QUIZ_VALIDATION_FAILED);
        verify(quizAiGenerationService, times(2)).requestQuiz(any(), any());
        verify(quizSetRepository, never()).save(any());
        verify(questionRepository, never()).save(any());
    }

    @Test
    void generateQuizDoesNotRegenerateWhenFirstAttemptExceededTimeBudget() {
        Note note = ownedNote(10L);
        when(noteRepository.findAllById(List.of(10L))).thenReturn(List.of(note));
        when(quizAiGenerationService.prepareInput(any(), any(), any())).thenReturn(textInput);
        when(quizAiGenerationService.requestQuiz(any(), any())).thenReturn(aiResponseWith());
        when(clock.instant()).thenReturn(Instant.EPOCH, Instant.EPOCH.plusSeconds(31));

        QuizRequest request = requestFor(List.of(10L), Map.of(QuestionType.MULTIPLE_CHOICE, 1));

        assertThatThrownBy(() -> quizService.generateQuiz(request, owner))
                .isInstanceOf(ExternalServiceException.class)
                .extracting("errorCode").isEqualTo(ExternalServiceException.QUIZ_VALIDATION_FAILED);
        verify(quizAiGenerationService, times(1)).requestQuiz(any(), any());
    }

    @Test
    void generateQuizDoesNotRegenerateWhenAiCallFails() {
        Note note = ownedNote(10L);
        when(noteRepository.findAllById(List.of(10L))).thenReturn(List.of(note));
        when(quizAiGenerationService.prepareInput(any(), any(), any())).thenReturn(textInput);
        when(quizAiGenerationService.requestQuiz(any(), any()))
                .thenThrow(new ExternalServiceException("AI 퀴즈 생성 서비스에 연결할 수 없습니다."));

        QuizRequest request = requestFor(List.of(10L), Map.of(QuestionType.MULTIPLE_CHOICE, 1));

        assertThatThrownBy(() -> quizService.generateQuiz(request, owner))
                .isInstanceOf(ExternalServiceException.class)
                .extracting("errorCode").isEqualTo(ExternalServiceException.EXTERNAL_SERVICE_ERROR);
        verify(quizAiGenerationService, times(1)).requestQuiz(any(), any());
    }

    @Test
    void generateQuizRegeneratesWhenAiResponseCannotBeParsed() {
        Note note = ownedNote(10L);
        when(noteRepository.findAllById(List.of(10L))).thenReturn(List.of(note));
        when(quizAiGenerationService.prepareInput(any(), any(), any())).thenReturn(textInput);
        QuizResponse validResponse = aiResponseWith(multipleChoice("페이지 교체 알고리즘은?", "LRU"));
        when(quizAiGenerationService.requestQuiz(any(), any()))
                .thenThrow(new ExternalServiceException(ExternalServiceException.AI_RESPONSE_INVALID, "형식 오류"))
                .thenReturn(validResponse);

        QuizRequest request = requestFor(List.of(10L), Map.of(QuestionType.MULTIPLE_CHOICE, 1));

        assertThat(quizService.generateQuiz(request, owner)).isSameAs(validResponse);
        verify(quizAiGenerationService, times(2)).requestQuiz(any(), any());
    }

    private static long countGenerationLogLines(CapturedOutput output) {
        return output.getOut().lines().filter(line -> line.contains("quiz.generation ")).count();
    }

    @Test
    void generateQuizLogsOneSuccessLineWithGenerationMetadata(CapturedOutput output) {
        Note note = ownedNote(10L);
        when(noteRepository.findAllById(List.of(10L))).thenReturn(List.of(note));
        when(quizAiGenerationService.prepareInput(any(), any(), any())).thenReturn(textInput);
        when(quizAiGenerationService.requestQuiz(any(), any()))
                .thenReturn(aiResponseWith(multipleChoice("페이지 교체 알고리즘은?", "LRU")));

        quizService.generateQuiz(requestFor(List.of(10L), Map.of(QuestionType.MULTIPLE_CHOICE, 1)), owner);

        assertThat(countGenerationLogLines(output)).isEqualTo(1);
        assertThat(output.getOut())
                .contains("quiz.generation status=SUCCESS")
                .contains("model=" + QuizAiGenerationService.MODEL_NAME)
                .contains("promptVersion=" + QuizAiGenerationService.PROMPT_VERSION)
                .contains("attempts=1 unverified=0")
                .contains("studId=1")
                .containsPattern("contentHash=[0-9a-f]{64} textChars=" + textInput.text().length())
                // 노트 본문은 로그에 남기지 않는다.
                .doesNotContain("[[REF:10/b1]]");
    }

    @Test
    void generateQuizLogsRegenerationInSuccessLine(CapturedOutput output) {
        Note note = ownedNote(10L);
        when(noteRepository.findAllById(List.of(10L))).thenReturn(List.of(note));
        when(quizAiGenerationService.prepareInput(any(), any(), any())).thenReturn(textInput);
        when(quizAiGenerationService.requestQuiz(any(), any()))
                .thenReturn(aiResponseWith(), aiResponseWith(multipleChoice("페이지 교체 알고리즘은?", "LRU")));

        quizService.generateQuiz(requestFor(List.of(10L), Map.of(QuestionType.MULTIPLE_CHOICE, 1)), owner);

        assertThat(countGenerationLogLines(output)).isEqualTo(1);
        assertThat(output.getOut()).contains("status=SUCCESS").contains("attempts=2");
    }

    @Test
    void generateQuizLogsValidationFailure(CapturedOutput output) {
        Note note = ownedNote(10L);
        when(noteRepository.findAllById(List.of(10L))).thenReturn(List.of(note));
        when(quizAiGenerationService.prepareInput(any(), any(), any())).thenReturn(textInput);
        when(quizAiGenerationService.requestQuiz(any(), any())).thenReturn(aiResponseWith(), aiResponseWith());

        assertThatThrownBy(() -> quizService.generateQuiz(
                requestFor(List.of(10L), Map.of(QuestionType.MULTIPLE_CHOICE, 1)), owner))
                .isInstanceOf(ExternalServiceException.class);

        assertThat(countGenerationLogLines(output)).isEqualTo(1);
        assertThat(output.getOut())
                .contains("status=FAILED")
                .contains("attempts=2")
                .contains("failureCode=" + ExternalServiceException.QUIZ_VALIDATION_FAILED)
                .contains("failureReason=\"문항이 없습니다.\"");
    }

    private static QuizRequest.BlockSelection selection(long noteId, String... blockIds) {
        QuizRequest.BlockSelection selection = new QuizRequest.BlockSelection();
        selection.setNoteId(noteId);
        selection.setBlockIds(List.of(blockIds));
        return selection;
    }

    @Test
    void generateQuizPassesPerNoteBlockScopesAndLogsBlockScope(CapturedOutput output) {
        Note note1 = ownedNote(10L);
        Note note2 = ownedNote(11L);
        Note note3 = ownedNote(12L);
        when(noteRepository.findAllById(List.of(10L, 11L, 12L))).thenReturn(List.of(note1, note2, note3));
        when(quizAiGenerationService.prepareInput(any(), any(), any())).thenReturn(textInput);
        when(quizAiGenerationService.requestQuiz(any(), any()))
                .thenReturn(aiResponseWith(multipleChoice("페이지 교체 알고리즘은?", "LRU")));
        QuizRequest request = requestFor(List.of(10L, 11L, 12L), Map.of(QuestionType.MULTIPLE_CHOICE, 1));
        // 노트 10은 전체, 11·12는 블록 일부. 같은 노트가 여러 번 오면 합치고 중복은 한 번만 센다.
        request.setBlockSelections(List.of(selection(11L, "b1", "b2"), selection(12L, "b1"), selection(11L, "b2", "b3")));

        quizService.generateQuiz(request, owner);

        verify(quizAiGenerationService).prepareInput(eq(List.of(note1, note2, note3)), eq(owner),
                eq(Map.of(11L, Set.of("b1", "b2", "b3"), 12L, Set.of("b1"))));
        assertThat(output.getOut()).contains("status=SUCCESS").contains("blockCount=4 blockNoteCount=2");
    }

    @Test
    void generateQuizWithoutBlockSelectionsUsesWholeNoteScope(CapturedOutput output) {
        Note note = ownedNote(10L);
        when(noteRepository.findAllById(List.of(10L))).thenReturn(List.of(note));
        when(quizAiGenerationService.prepareInput(any(), any(), any())).thenReturn(textInput);
        when(quizAiGenerationService.requestQuiz(any(), any()))
                .thenReturn(aiResponseWith(multipleChoice("페이지 교체 알고리즘은?", "LRU")));
        QuizRequest request = requestFor(List.of(10L), Map.of(QuestionType.MULTIPLE_CHOICE, 1));
        request.setBlockSelections(List.of());

        quizService.generateQuiz(request, owner);

        verify(quizAiGenerationService).prepareInput(eq(List.of(note)), eq(owner), eq(Map.of()));
        assertThat(output.getOut()).contains("blockCount=0 blockNoteCount=0");
    }

    @Test
    void generateQuizRejectsBlockSelectionForNoteOutsideNoteIdsWithoutCallingAi() {
        Note note = ownedNote(10L);
        when(noteRepository.findAllById(List.of(10L))).thenReturn(List.of(note));
        QuizRequest request = requestFor(List.of(10L), Map.of(QuestionType.MULTIPLE_CHOICE, 1));
        // noteIds 밖의 노트(소유권·강의 검증을 거치지 않은 노트)의 블록은 허용하지 않는다.
        request.setBlockSelections(List.of(selection(99L, "b1")));

        assertThatThrownBy(() -> quizService.generateQuiz(request, owner))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("요청 노트 목록에 없습니다");
        verify(quizAiGenerationService, never()).prepareInput(any(), any(), any());
        verify(quizAiGenerationService, never()).requestQuiz(any(), any());
    }

    @Test
    void generateQuizRejectsTooManySelectedBlocksAcrossNotes() {
        Note note1 = ownedNote(10L);
        Note note2 = ownedNote(11L);
        when(noteRepository.findAllById(List.of(10L, 11L))).thenReturn(List.of(note1, note2));
        QuizRequest request = requestFor(List.of(10L, 11L), Map.of(QuestionType.MULTIPLE_CHOICE, 1));
        String[] first = java.util.stream.IntStream.range(0, 300).mapToObj(i -> "a" + i).toArray(String[]::new);
        String[] second = java.util.stream.IntStream.range(0, 201).mapToObj(i -> "b" + i).toArray(String[]::new);
        request.setBlockSelections(List.of(selection(10L, first), selection(11L, second)));

        assertThatThrownBy(() -> quizService.generateQuiz(request, owner))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("최대 500개");
        verify(quizAiGenerationService, never()).prepareInput(any(), any(), any());
    }

    @Test
    void generateQuizRejectsEmptyBlockScopeWithoutCallingAi() {
        Note note = ownedNote(10L);
        when(noteRepository.findAllById(List.of(10L))).thenReturn(List.of(note));
        when(quizAiGenerationService.prepareInput(any(), any(), any()))
                .thenReturn(new QuizGenerationInput(" ", List.of(), Map.of()));
        QuizRequest request = requestFor(List.of(10L), Map.of(QuestionType.MULTIPLE_CHOICE, 1));
        request.setBlockSelections(List.of(selection(10L, "empty")));

        assertThatThrownBy(() -> quizService.generateQuiz(request, owner))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessage("선택한 범위에 문제를 생성할 내용이 없습니다.");
        verify(quizAiGenerationService, never()).requestQuiz(any(), any());
    }

    @Test
    void generateQuizLogsAiCallFailure(CapturedOutput output) {
        Note note = ownedNote(10L);
        when(noteRepository.findAllById(List.of(10L))).thenReturn(List.of(note));
        when(quizAiGenerationService.prepareInput(any(), any(), any())).thenReturn(textInput);
        when(quizAiGenerationService.requestQuiz(any(), any()))
                .thenThrow(new ExternalServiceException("AI 퀴즈 생성 서비스에 연결할 수 없습니다."));

        assertThatThrownBy(() -> quizService.generateQuiz(
                requestFor(List.of(10L), Map.of(QuestionType.MULTIPLE_CHOICE, 1)), owner))
                .isInstanceOf(ExternalServiceException.class);

        assertThat(countGenerationLogLines(output)).isEqualTo(1);
        assertThat(output.getOut())
                .contains("status=FAILED")
                .contains("attempts=1")
                .contains("failureCode=" + ExternalServiceException.EXTERNAL_SERVICE_ERROR);
    }

    @Test
    void generateQuizRejectsWhenNotesBelongToDifferentCourses() throws Exception {
        Note noteInCourse = new Note();
        noteInCourse.setNoteId(10L);
        noteInCourse.setStudent(owner);
        noteInCourse.setCourse(course);

        Note noteInAnotherCourse = new Note();
        noteInAnotherCourse.setNoteId(11L);
        noteInAnotherCourse.setStudent(owner);
        noteInAnotherCourse.setCourse(anotherCourse);

        when(noteRepository.findAllById(List.of(10L, 11L))).thenReturn(List.of(noteInCourse, noteInAnotherCourse));

        QuizRequest request = new QuizRequest();
        request.setNoteIds(List.of(10L, 11L));

        assertThatThrownBy(() -> quizService.generateQuiz(request, owner))
                .isInstanceOf(InvalidRequestException.class);

        verifyNoInteractions(quizAiGenerationService);
    }

    @Test
    void generateQuizRejectsWhenTotalQuestionCountExceedsLimit() {
        Note note = new Note();
        note.setNoteId(10L);
        note.setStudent(owner);
        note.setCourse(course);
        when(noteRepository.findAllById(List.of(10L))).thenReturn(List.of(note));

        QuizRequest request = new QuizRequest();
        request.setNoteIds(List.of(10L));
        request.setTypeCounts(Map.of(
                QuestionType.MULTIPLE_CHOICE, 15,
                QuestionType.SHORT_ANSWER, 15,
                QuestionType.OX, 5));

        assertThatThrownBy(() -> quizService.generateQuiz(request, owner))
                .isInstanceOf(InvalidRequestException.class);

        verifyNoInteractions(quizAiGenerationService);
    }

    @Test
    void generateQuizRejectsWhenTooManyNotesRequested() {
        List<Long> noteIds = new java.util.ArrayList<>();
        List<Note> notes = new java.util.ArrayList<>();
        for (long i = 1; i <= 21; i++) {
            Note note = new Note();
            note.setNoteId(i);
            note.setStudent(owner);
            note.setCourse(course);
            noteIds.add(i);
            notes.add(note);
        }
        when(noteRepository.findAllById(noteIds)).thenReturn(notes);

        QuizRequest request = new QuizRequest();
        request.setNoteIds(noteIds);
        request.setTypeCounts(Map.of(QuestionType.MULTIPLE_CHOICE, 5));

        assertThatThrownBy(() -> quizService.generateQuiz(request, owner))
                .isInstanceOf(InvalidRequestException.class);

        verifyNoInteractions(quizAiGenerationService);
    }

    @Test
    void ownerCanDeleteOwnQuiz() {
        when(quizSetRepository.findById(50L)).thenReturn(Optional.of(quizSet));

        quizService.deleteQuiz(50L, owner);

        verify(incorrectNoteItemRepository).deleteByQuestion_QuizSet_QuizSetId(50L);
        verify(userAnswerRepository).deleteByQuestion_QuizSet_QuizSetId(50L);
        verify(quizSetRepository).delete(quizSet);
    }

    @Test
    void otherStudentCannotDeleteSomeoneElsesQuiz() {
        when(quizSetRepository.findById(50L)).thenReturn(Optional.of(quizSet));

        assertThatThrownBy(() -> quizService.deleteQuiz(50L, other))
                .isInstanceOf(CourseAccessException.class);

        verify(incorrectNoteItemRepository, never()).deleteByQuestion_QuizSet_QuizSetId(any());
        verify(userAnswerRepository, never()).deleteByQuestion_QuizSet_QuizSetId(any());
        verify(quizSetRepository, never()).delete(any());
    }

    @Test
    void ownerCanDeleteOwnAttempt() {
        when(quizAttemptRepository.findById(70L)).thenReturn(Optional.of(attempt));

        quizService.deleteAttempt(70L, owner);

        verify(quizAttemptRepository).delete(attempt);
    }

    @Test
    void otherStudentCannotDeleteSomeoneElsesAttempt() {
        when(quizAttemptRepository.findById(70L)).thenReturn(Optional.of(attempt));

        assertThatThrownBy(() -> quizService.deleteAttempt(70L, other))
                .isInstanceOf(CourseAccessException.class);
        verify(quizAttemptRepository, never()).delete(any());
    }

    @Test
    void deletingMissingAttemptIsNotFound() {
        when(quizAttemptRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> quizService.deleteAttempt(999L, owner))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void deletingMissingQuizIsNotFound() {
        when(quizSetRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> quizService.deleteQuiz(999L, owner))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void generateQuizRejectsWhenARequestedNoteIdDoesNotExist() throws Exception {
        Note note = new Note();
        note.setNoteId(10L);
        note.setStudent(owner);

        // 노트 하나(11L)가 존재하지 않아 findAllById가 조용히 하나만 반환하는 상황
        when(noteRepository.findAllById(List.of(10L, 11L))).thenReturn(List.of(note));

        QuizRequest request = new QuizRequest();
        request.setNoteIds(List.of(10L, 11L));

        assertThatThrownBy(() -> quizService.generateQuiz(request, owner))
                .isInstanceOf(InvalidRequestException.class);

        verifyNoInteractions(quizAiGenerationService);
    }

    private QuizSetQuestionCount countOf(Long quizSetId, long count) {
        QuizSetQuestionCount projection = mock(QuizSetQuestionCount.class);
        when(projection.getQuizSetId()).thenReturn(quizSetId);
        when(projection.getCount()).thenReturn(count);
        return projection;
    }

    @Test
    void getMyAttemptsUsesBatchedQuestionCountInsteadOfPerAttemptLazyLoad() {
        quizSet.setCourse(course);
        attempt.setQuizSet(quizSet);

        when(quizAttemptRepository.findByStudent_StudId(owner.getStudId())).thenReturn(List.of(attempt));
        QuizSetQuestionCount count = countOf(50L, 3L);
        when(questionRepository.countByQuizSetIdIn(List.of(50L))).thenReturn(List.of(count));

        List<QuizAttemptResponse> responses = quizService.getMyAttempts(owner);

        assertThat(responses).hasSize(1);
        assertThat(responses.get(0).getTotalQuestions()).isEqualTo(3);
        // 풀이 기록 개수와 무관하게 문제 개수 배치 조회는 한 번만 호출되어야 한다(N+1 회귀 방지).
        verify(questionRepository, times(1)).countByQuizSetIdIn(any());
    }

    @Test
    void getMyAttemptsDefaultsToZeroQuestionsWhenNoCountFound() {
        quizSet.setCourse(course);
        attempt.setQuizSet(quizSet);

        when(quizAttemptRepository.findByStudent_StudId(owner.getStudId())).thenReturn(List.of(attempt));
        when(questionRepository.countByQuizSetIdIn(List.of(50L))).thenReturn(List.of());

        List<QuizAttemptResponse> responses = quizService.getMyAttempts(owner);

        assertThat(responses.get(0).getTotalQuestions()).isZero();
    }

    @Test
    void getAttemptsByQuizSetUsesBatchedQuestionCount() {
        quizSet.setCourse(course);
        attempt.setQuizSet(quizSet);

        when(quizAttemptRepository.findByQuizSet_QuizSetIdAndStudent_StudId(50L, owner.getStudId()))
                .thenReturn(List.of(attempt));
        QuizSetQuestionCount count = countOf(50L, 5L);
        when(questionRepository.countByQuizSetIdIn(List.of(50L))).thenReturn(List.of(count));

        List<QuizAttemptResponse> responses = quizService.getAttemptsByQuizSet(50L, owner);

        assertThat(responses).hasSize(1);
        assertThat(responses.get(0).getTotalQuestions()).isEqualTo(5);
    }
}
