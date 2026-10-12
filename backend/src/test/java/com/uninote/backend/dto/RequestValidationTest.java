package com.uninote.backend.dto;

import com.uninote.backend.domain.QuestionType;
import com.uninote.backend.domain.QuizDifficulty;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

// 컨트롤러의 @Valid는 Spring MVC 디스패치 과정에서만 동작하므로, 이 저장소의 컨트롤러 테스트
// 관례(순수 단위 테스트, MockMvc 미사용)로는 검증되지 않는다. 대신 DTO의 Bean Validation
// 제약 자체를 Validator로 직접 검증한다.
class RequestValidationTest {

    private static Validator validator;

    @BeforeAll
    static void setUp() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void loginRequestRejectsBlankFields() {
        LoginRequest request = new LoginRequest();
        request.setStudentNum(" ");
        request.setPassword("");

        Set<ConstraintViolation<LoginRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString())
                .containsExactlyInAnyOrder("studentNum", "password");
    }

    @Test
    void postRequestRejectsBlankTitleAndContent() {
        PostRequest request = new PostRequest("", "");

        Set<ConstraintViolation<PostRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString())
                .containsExactlyInAnyOrder("title", "content");
    }

    @Test
    void commentRequestRejectsBlankContent() {
        CommentRequest request = new CommentRequest("   ");

        Set<ConstraintViolation<CommentRequest>> violations = validator.validate(request);

        assertThat(violations).hasSize(1);
    }

    @Test
    void noteRequestRejectsBlankTitleAndContentButAllowsEmptyPreviewAndSearch() {
        NoteRequest request = new NoteRequest("", "", "", "");

        Set<ConstraintViolation<NoteRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString())
                .containsExactlyInAnyOrder("title", "content");
    }

    @Test
    void noteRequestAcceptsValidTitleWithEmptyPreviewAndSearchContent() {
        NoteRequest request = new NoteRequest("제목 없음", "{\"type\":\"doc\"}", "", "");

        Set<ConstraintViolation<NoteRequest>> violations = validator.validate(request);

        assertThat(violations).isEmpty();
    }

    @Test
    void addToIncorrectRequestRequiresQuestionIdOnly() {
        AddToIncorrectRequest request = new AddToIncorrectRequest();
        request.setGroupId(1L);
        request.setQuestionId(null);

        Set<ConstraintViolation<AddToIncorrectRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString())
                .containsExactly("questionId");
    }

    @Test
    void quizRequestRejectsEmptyNoteIdsAndTypeCountsAndMissingDifficulty() {
        QuizRequest request = new QuizRequest();
        request.setNoteIds(List.of());
        request.setTypeCounts(Map.of());
        request.setDifficulty(null);

        Set<ConstraintViolation<QuizRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString())
                .containsExactlyInAnyOrder("noteIds", "typeCounts", "difficulty");
    }

    @Test
    void quizRequestAcceptsValidPayload() {
        QuizRequest request = new QuizRequest();
        request.setNoteIds(List.of(1L, 2L));
        request.setTypeCounts(Map.of(QuestionType.MULTIPLE_CHOICE, 2));
        request.setDifficulty(QuizDifficulty.NORMAL);

        Set<ConstraintViolation<QuizRequest>> violations = validator.validate(request);

        assertThat(violations).isEmpty();
    }

    @Test
    void quizAttemptRequestRejectsMissingQuizSetIdAndEmptyAnswers() {
        QuizAttemptRequest request = new QuizAttemptRequest();
        request.setQuizSetId(null);
        request.setUserAnswers(List.of());

        Set<ConstraintViolation<QuizAttemptRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString())
                .containsExactlyInAnyOrder("quizSetId", "userAnswers");
    }

    @Test
    void quizAttemptRequestAllowsNullSubmittedAnswerForSkippedQuestion() {
        QuizAttemptRequest.UserAnswerRequest skipped = new QuizAttemptRequest.UserAnswerRequest();
        skipped.setQuestionId(1L);
        skipped.setSubmittedAnswer(null);

        QuizAttemptRequest request = new QuizAttemptRequest();
        request.setQuizSetId(10L);
        request.setUserAnswers(List.of(skipped));

        Set<ConstraintViolation<QuizAttemptRequest>> violations = validator.validate(request);

        assertThat(violations).isEmpty();
    }

    @Test
    void quizAttemptRequestRejectsAnswerWithoutQuestionId() {
        QuizAttemptRequest.UserAnswerRequest invalid = new QuizAttemptRequest.UserAnswerRequest();
        invalid.setQuestionId(null);
        invalid.setSubmittedAnswer("답안");

        QuizAttemptRequest request = new QuizAttemptRequest();
        request.setQuizSetId(10L);
        request.setUserAnswers(List.of(invalid));

        Set<ConstraintViolation<QuizAttemptRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString())
                .containsExactly("userAnswers[0].questionId");
    }
}
