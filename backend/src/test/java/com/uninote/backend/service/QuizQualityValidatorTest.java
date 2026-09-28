package com.uninote.backend.service;

import com.uninote.backend.domain.QuestionType;
import com.uninote.backend.domain.QuizDifficulty;
import com.uninote.backend.dto.QuestionResponse;
import com.uninote.backend.dto.QuizRequest;
import com.uninote.backend.dto.QuizResponse;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class QuizQualityValidatorTest {

    private final QuizQualityValidator validator = new QuizQualityValidator();
    private final Map<Long, Set<String>> allowedSources = Map.of(10L, Set.of("b1", "b2"));

    private QuizRequest request(Map<QuestionType, Integer> typeCounts) {
        QuizRequest request = new QuizRequest();
        request.setNoteIds(List.of(10L));
        request.setTypeCounts(typeCounts);
        request.setDifficulty(QuizDifficulty.HARD);
        return request;
    }

    private QuestionResponse question(QuestionType type, String text, String answer, List<String> options) {
        QuestionResponse q = new QuestionResponse();
        q.setType(type);
        q.setQuestionText(text);
        q.setCorrectAnswer(answer);
        q.setOptions(options);
        q.setSourceNoteId(10L);
        q.setSourceBlockId("b1");
        return q;
    }

    private QuestionResponse mc(String text, String answer) {
        return question(QuestionType.MULTIPLE_CHOICE, text, answer, List.of("LRU", "FIFO", "OPT"));
    }

    private QuestionResponse ox(String text, String answer) {
        return question(QuestionType.OX, text, answer, null);
    }

    private QuestionResponse shortAnswer(String text, String answer) {
        return question(QuestionType.SHORT_ANSWER, text, answer, null);
    }

    private QuizResponse response(QuestionResponse... questions) {
        QuizResponse response = new QuizResponse();
        response.setTitle("퀴즈");
        response.setDifficulty(QuizDifficulty.EASY);
        response.setQuestions(new ArrayList<>(List.of(questions)));
        return response;
    }

    @Test
    void validResponsePassesAndDifficultyIsOverriddenWithRequestedValue() {
        QuizResponse response = response(mc("Q1", "LRU"), ox("Q2", "O"), shortAnswer("Q3", "페이지 폴트"));

        QuizQualityValidator.Result result = validator.validate(response, request(Map.of(
                QuestionType.MULTIPLE_CHOICE, 1, QuestionType.OX, 1, QuestionType.SHORT_ANSWER, 1)), allowedSources);

        assertThat(result.valid()).isTrue();
        assertThat(result.unverifiedCount()).isZero();
        assertThat(response.getDifficulty()).isEqualTo(QuizDifficulty.HARD);
    }

    @Test
    void emptyQuestionsFail() {
        QuizQualityValidator.Result result = validator.validate(response(),
                request(Map.of(QuestionType.MULTIPLE_CHOICE, 1)), allowedSources);

        assertThat(result.valid()).isFalse();
    }

    @Test
    void totalQuestionCountMismatchFails() {
        QuizQualityValidator.Result result = validator.validate(response(mc("Q1", "LRU")),
                request(Map.of(QuestionType.MULTIPLE_CHOICE, 2)), allowedSources);

        assertThat(result.valid()).isFalse();
    }

    @Test
    void perTypeCountMismatchFailsEvenWhenTotalMatches() {
        QuizQualityValidator.Result result = validator.validate(response(mc("Q1", "LRU"), mc("Q2", "FIFO")),
                request(Map.of(QuestionType.MULTIPLE_CHOICE, 1, QuestionType.OX, 1)), allowedSources);

        assertThat(result.valid()).isFalse();
    }

    @Test
    void multipleChoiceAnswerDifferingOnlyInCaseAndSpacesIsReplacedWithOptionText() {
        QuizResponse response = response(mc("Q1", "  lru "));

        QuizQualityValidator.Result result = validator.validate(response,
                request(Map.of(QuestionType.MULTIPLE_CHOICE, 1)), allowedSources);

        assertThat(result.valid()).isTrue();
        assertThat(response.getQuestions().get(0).getCorrectAnswer()).isEqualTo("LRU");
    }

    @Test
    void multipleChoiceAnswerNotInOptionsFails() {
        QuizQualityValidator.Result result = validator.validate(response(mc("Q1", "LFU")),
                request(Map.of(QuestionType.MULTIPLE_CHOICE, 1)), allowedSources);

        assertThat(result.valid()).isFalse();
    }

    @Test
    void multipleChoiceWithTooFewOptionsFails() {
        QuestionResponse q = question(QuestionType.MULTIPLE_CHOICE, "Q1", "LRU", List.of("LRU"));

        QuizQualityValidator.Result result = validator.validate(response(q),
                request(Map.of(QuestionType.MULTIPLE_CHOICE, 1)), allowedSources);

        assertThat(result.valid()).isFalse();
    }

    @Test
    void multipleChoiceWithDuplicateOptionsFails() {
        QuestionResponse q = question(QuestionType.MULTIPLE_CHOICE, "Q1", "LRU", List.of("LRU", " lru", "FIFO"));

        QuizQualityValidator.Result result = validator.validate(response(q),
                request(Map.of(QuestionType.MULTIPLE_CHOICE, 1)), allowedSources);

        assertThat(result.valid()).isFalse();
    }

    @Test
    void oxAnswerIsNormalizedToUpperCase() {
        QuizResponse response = response(ox("Q1", " x "));

        QuizQualityValidator.Result result = validator.validate(response,
                request(Map.of(QuestionType.OX, 1)), allowedSources);

        assertThat(result.valid()).isTrue();
        assertThat(response.getQuestions().get(0).getCorrectAnswer()).isEqualTo("X");
    }

    @Test
    void oxAnswerOtherThanOOrXFails() {
        QuizQualityValidator.Result result = validator.validate(response(ox("Q1", "참")),
                request(Map.of(QuestionType.OX, 1)), allowedSources);

        assertThat(result.valid()).isFalse();
    }

    @Test
    void blankAnswerAndBlankQuestionTextFail() {
        QuizQualityValidator.Result blankAnswer = validator.validate(response(shortAnswer("Q1", " ")),
                request(Map.of(QuestionType.SHORT_ANSWER, 1)), allowedSources);
        QuizQualityValidator.Result blankText = validator.validate(response(shortAnswer(" ", "답")),
                request(Map.of(QuestionType.SHORT_ANSWER, 1)), allowedSources);

        assertThat(blankAnswer.valid()).isFalse();
        assertThat(blankText.valid()).isFalse();
    }

    @Test
    void answerLongerThanColumnLimitFails() {
        QuizQualityValidator.Result result = validator.validate(response(shortAnswer("Q1", "가".repeat(256))),
                request(Map.of(QuestionType.SHORT_ANSWER, 1)), allowedSources);

        assertThat(result.valid()).isFalse();
    }

    @Test
    void duplicateQuestionTextInSameSetFails() {
        QuizQualityValidator.Result result = validator.validate(response(mc("LRU란?", "LRU"), mc(" lru란? ", "FIFO")),
                request(Map.of(QuestionType.MULTIPLE_CHOICE, 2)), allowedSources);

        assertThat(result.valid()).isFalse();
    }

    @Test
    void forgedOrUnknownSourcesAreClearedWhenWithinUnverifiedLimit() {
        QuestionResponse verified1 = mc("Q1", "LRU");
        QuestionResponse verified2 = mc("Q2", "FIFO");
        QuestionResponse forgedNote = mc("Q3", "OPT");
        forgedNote.setSourceNoteId(99L); // 요청하지 않은 노트
        QuestionResponse unknownBlock = mc("Q4", "LRU");
        unknownBlock.setSourceBlockId("nope"); // 존재하지 않는 블록
        QuizResponse response = response(verified1, verified2, forgedNote, unknownBlock);

        QuizQualityValidator.Result result = validator.validate(response,
                request(Map.of(QuestionType.MULTIPLE_CHOICE, 4)), allowedSources);

        assertThat(result.valid()).isTrue();
        assertThat(result.unverifiedCount()).isEqualTo(2);
        assertThat(forgedNote.getSourceNoteId()).isNull();
        assertThat(forgedNote.getSourceBlockId()).isNull();
        assertThat(unknownBlock.getSourceNoteId()).isNull();
        assertThat(unknownBlock.getSourceBlockId()).isNull();
        assertThat(verified1.getSourceBlockId()).isEqualTo("b1");
    }

    @Test
    void tooManyUnverifiedSourcesFail() {
        QuestionResponse verified = mc("Q1", "LRU");
        QuestionResponse missing1 = mc("Q2", "FIFO");
        missing1.setSourceBlockId(null);
        QuestionResponse missing2 = mc("Q3", "OPT");
        missing2.setSourceNoteId(null);

        QuizQualityValidator.Result result = validator.validate(response(verified, missing1, missing2),
                request(Map.of(QuestionType.MULTIPLE_CHOICE, 3)), allowedSources);

        assertThat(result.valid()).isFalse();
    }

    @Test
    void failedValidationDoesNotModifyResponse() {
        QuestionResponse q = mc("Q1", "lru");
        QuizResponse response = response(q, ox("Q2", "참"));

        QuizQualityValidator.Result result = validator.validate(response,
                request(Map.of(QuestionType.MULTIPLE_CHOICE, 1, QuestionType.OX, 1)), allowedSources);

        assertThat(result.valid()).isFalse();
        assertThat(q.getCorrectAnswer()).isEqualTo("lru");
        assertThat(response.getDifficulty()).isEqualTo(QuizDifficulty.EASY);
    }

    @Test
    void blankTitleIsReplacedAndLongTitleIsTruncated() {
        QuizResponse blankTitle = response(mc("Q1", "LRU"));
        blankTitle.setTitle(" ");
        QuizResponse longTitle = response(mc("Q1", "LRU"));
        longTitle.setTitle("제".repeat(300));

        validator.validate(blankTitle, request(Map.of(QuestionType.MULTIPLE_CHOICE, 1)), allowedSources);
        validator.validate(longTitle, request(Map.of(QuestionType.MULTIPLE_CHOICE, 1)), allowedSources);

        assertThat(blankTitle.getTitle()).isEqualTo(QuizQualityValidator.DEFAULT_TITLE);
        assertThat(longTitle.getTitle()).hasSize(QuizQualityValidator.MAX_COLUMN_LENGTH);
    }
}
