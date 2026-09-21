package com.uninote.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uninote.backend.domain.Course;
import com.uninote.backend.domain.Note;
import com.uninote.backend.domain.Question;
import com.uninote.backend.domain.QuizAttempt;
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
import com.uninote.backend.exception.InvalidRequestException;
import com.uninote.backend.exception.ResourceNotFoundException;
import com.uninote.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class QuizServiceTest {

    private final NoteRepository noteRepository = mock(NoteRepository.class);
    private final QuizSetRepository quizSetRepository = mock(QuizSetRepository.class);
    private final QuizAttemptRepository quizAttemptRepository = mock(QuizAttemptRepository.class);
    private final UserAnswerRepository userAnswerRepository = mock(UserAnswerRepository.class);
    private final QuestionRepository questionRepository = mock(QuestionRepository.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final QuizAiGenerationService quizAiGenerationService = mock(QuizAiGenerationService.class);
    private final QuestionResponseMapper questionResponseMapper = mock(QuestionResponseMapper.class);

    private final QuizService quizService = new QuizService(
            noteRepository, quizSetRepository, quizAttemptRepository, userAnswerRepository,
            questionRepository, objectMapper, quizAiGenerationService, questionResponseMapper);

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
        Note note = new Note();
        note.setNoteId(10L);
        note.setStudent(owner);
        note.setCourse(course);

        when(noteRepository.findAllById(List.of(10L))).thenReturn(List.of(note));
        QuizResponse aiResponse = new QuizResponse();
        aiResponse.setQuestions(Collections.emptyList());
        when(quizAiGenerationService.generateQuizContent(any(), any(), any())).thenReturn(aiResponse);

        QuizRequest request = new QuizRequest();
        request.setNoteIds(List.of(10L));
        request.setTypeCounts(Map.of(QuestionType.MULTIPLE_CHOICE, 5));

        QuizResponse response = quizService.generateQuiz(request, owner);

        assertThat(response).isSameAs(aiResponse);
        verify(quizAiGenerationService).generateQuizContent(request, List.of(note), owner);
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
        Note note1 = new Note();
        note1.setNoteId(10L);
        note1.setStudent(owner);
        note1.setCourse(course);

        Note note2 = new Note();
        note2.setNoteId(11L);
        note2.setStudent(owner);
        note2.setCourse(course);

        when(noteRepository.findAllById(List.of(10L, 11L))).thenReturn(List.of(note1, note2));
        QuizResponse aiResponse = new QuizResponse();
        aiResponse.setQuestions(Collections.emptyList());
        when(quizAiGenerationService.generateQuizContent(any(), any(), any())).thenReturn(aiResponse);

        QuizRequest request = new QuizRequest();
        request.setNoteIds(List.of(10L, 11L));
        request.setTypeCounts(Map.of(QuestionType.MULTIPLE_CHOICE, 5));

        QuizResponse response = quizService.generateQuiz(request, owner);

        assertThat(response).isSameAs(aiResponse);
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
    void generateQuizRejectsWhenTypeCountsAreMissing() {
        Note note = new Note();
        note.setNoteId(10L);
        note.setStudent(owner);
        note.setCourse(course);
        when(noteRepository.findAllById(List.of(10L))).thenReturn(List.of(note));

        QuizRequest request = new QuizRequest();
        request.setNoteIds(List.of(10L));

        assertThatThrownBy(() -> quizService.generateQuiz(request, owner))
                .isInstanceOf(InvalidRequestException.class);

        verifyNoInteractions(quizAiGenerationService);
    }

    @Test
    void generateQuizRejectsWhenPerTypeCountExceedsLimit() {
        Note note = new Note();
        note.setNoteId(10L);
        note.setStudent(owner);
        note.setCourse(course);
        when(noteRepository.findAllById(List.of(10L))).thenReturn(List.of(note));

        QuizRequest request = new QuizRequest();
        request.setNoteIds(List.of(10L));
        request.setTypeCounts(Map.of(QuestionType.MULTIPLE_CHOICE, 21));

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

        verify(quizSetRepository).delete(quizSet);
    }

    @Test
    void otherStudentCannotDeleteSomeoneElsesQuiz() {
        when(quizSetRepository.findById(50L)).thenReturn(Optional.of(quizSet));

        assertThatThrownBy(() -> quizService.deleteQuiz(50L, other))
                .isInstanceOf(CourseAccessException.class);

        verify(quizSetRepository, never()).delete(any());
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
