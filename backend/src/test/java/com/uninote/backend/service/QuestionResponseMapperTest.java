package com.uninote.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uninote.backend.domain.Question;
import com.uninote.backend.domain.QuestionType;
import com.uninote.backend.dto.QuestionResponse;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class QuestionResponseMapperTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final QuestionResponseMapper mapper = new QuestionResponseMapper(objectMapper);

    @Test
    void mapsOptionsAndSourceMetadataFromQuestion() throws Exception {
        Question question = new Question();
        question.setQuestionId(1L);
        question.setType(QuestionType.MULTIPLE_CHOICE);
        question.setQuestionText("질문");
        question.setOptions(objectMapper.writeValueAsString(List.of("A", "B")));
        question.setCorrectAnswer("A");
        question.setExplanation("설명");
        question.setSourceNoteId(10L);
        question.setSourceBlockId("b1");

        QuestionResponse response = mapper.toResponse(question);

        assertThat(response.getQuestionId()).isEqualTo(1L);
        assertThat(response.getType()).isEqualTo(QuestionType.MULTIPLE_CHOICE);
        assertThat(response.getQuestionText()).isEqualTo("질문");
        assertThat(response.getOptions()).containsExactly("A", "B");
        assertThat(response.getCorrectAnswer()).isEqualTo("A");
        assertThat(response.getExplanation()).isEqualTo("설명");
        assertThat(response.getSourceNoteId()).isEqualTo(10L);
        assertThat(response.getSourceBlockId()).isEqualTo("b1");
    }

    @Test
    void returnsEmptyOptionsWhenStoredJsonIsInvalid() {
        Question question = new Question();
        question.setQuestionId(2L);
        question.setQuestionText("질문");
        question.setOptions("not-json");
        question.setCorrectAnswer("A");

        QuestionResponse response = mapper.toResponse(question);

        assertThat(response.getOptions()).isEmpty();
    }
}
