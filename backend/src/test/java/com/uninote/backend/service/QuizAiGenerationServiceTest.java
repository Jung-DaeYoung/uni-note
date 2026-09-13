package com.uninote.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uninote.backend.domain.Note;
import com.uninote.backend.domain.QuestionType;
import com.uninote.backend.domain.QuizDifficulty;
import com.uninote.backend.dto.QuizRequest;
import com.uninote.backend.dto.QuizResponse;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpEntity;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class QuizAiGenerationServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = mock(RestTemplate.class);
    private final QuizAiGenerationService service = new QuizAiGenerationService(objectMapper, restTemplate);

    @Test
    void buildsPromptFromNoteContentAndParsesGeminiResponse() throws Exception {
        Note note = new Note();
        note.setNoteId(1L);
        note.setContent("{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"attrs\":{\"id\":\"b1\"}," +
            "\"content\":[{\"type\":\"text\",\"text\":\"Hello World\"}]}]}");

        QuizRequest request = new QuizRequest();
        request.setNoteIds(List.of(1L));
        request.setTypeCounts(Map.of(QuestionType.MULTIPLE_CHOICE, 2));
        request.setDifficulty(QuizDifficulty.NORMAL);

        String quizJson = "{\"title\":\"제목\",\"difficulty\":\"NORMAL\",\"questions\":[{" +
            "\"type\":\"MULTIPLE_CHOICE\",\"questionText\":\"Q1\",\"options\":[\"A\",\"B\"]," +
            "\"correctAnswer\":\"A\",\"explanation\":\"exp\",\"sourceNoteId\":1,\"sourceBlockId\":\"b1\"}]}";
        String rawGeminiResponse = objectMapper.writeValueAsString(Map.of(
            "candidates", List.of(Map.of(
                "content", Map.of("parts", List.of(Map.of("text", quizJson)))
            ))
        ));

        when(restTemplate.postForObject(anyString(), any(HttpEntity.class), eq(String.class)))
            .thenReturn(rawGeminiResponse);

        QuizResponse response = service.generateQuizContent(request, List.of(note));

        assertThat(response.getTitle()).isEqualTo("제목");
        assertThat(response.getDifficulty()).isEqualTo(QuizDifficulty.NORMAL);
        assertThat(response.getQuestions()).hasSize(1);
        assertThat(response.getQuestions().get(0).getSourceNoteId()).isEqualTo(1L);
        assertThat(response.getQuestions().get(0).getSourceBlockId()).isEqualTo("b1");
        assertThat(response.getQuestions().get(0).getOptions()).containsExactly("A", "B");

        ArgumentCaptor<HttpEntity> entityCaptor = ArgumentCaptor.forClass(HttpEntity.class);
        org.mockito.Mockito.verify(restTemplate).postForObject(anyString(), entityCaptor.capture(), eq(String.class));

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) entityCaptor.getValue().getBody();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> contents = (List<Map<String, Object>>) body.get("contents");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> parts = (List<Map<String, Object>>) contents.get(0).get("parts");
        String prompt = (String) parts.get(0).get("text");

        assertThat(prompt).contains("[[REF:1/b1]]");
        assertThat(prompt).contains("Hello World");
        assertThat(prompt).contains("MULTIPLE_CHOICE 2문제");
    }

    @Test
    void normalizesNullQuestionsToEmptyList() throws Exception {
        QuizRequest request = new QuizRequest();
        request.setNoteIds(List.of());
        request.setTypeCounts(Map.of(QuestionType.OX, 1));
        request.setDifficulty(QuizDifficulty.EASY);

        String quizJson = "{\"title\":\"제목2\",\"difficulty\":\"EASY\",\"questions\":null}";
        String rawGeminiResponse = objectMapper.writeValueAsString(Map.of(
            "candidates", List.of(Map.of(
                "content", Map.of("parts", List.of(Map.of("text", quizJson)))
            ))
        ));

        when(restTemplate.postForObject(anyString(), any(HttpEntity.class), eq(String.class)))
            .thenReturn(rawGeminiResponse);

        QuizResponse response = service.generateQuizContent(request, List.of());

        assertThat(response.getQuestions()).isNotNull();
        assertThat(response.getQuestions()).isEmpty();
    }
}
