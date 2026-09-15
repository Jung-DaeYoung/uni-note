package com.uninote.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uninote.backend.domain.Note;
import com.uninote.backend.domain.QuestionType;
import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.QuizRequest;
import com.uninote.backend.dto.QuizResponse;
import com.uninote.backend.exception.ExternalServiceException;
import com.uninote.backend.security.FileAccessSigner;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

// 미디어 파일 관련 테스트는 실제 애플리케이션이 쓰는 것과 같은 backend/uploads 디렉터리에
// 테스트 파일을 만들고 끝나면 지운다(ImageUploadControllerTest와 동일한 패턴).
class QuizAiGenerationServiceTest {

    private static final String SECRET = "test_jwt_secret_key_minimum_32_bytes_long";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = mock(RestTemplate.class);
    private final FileAccessSigner fileAccessSigner = new FileAccessSigner(SECRET);
    private final QuizAiGenerationService service =
            new QuizAiGenerationService(objectMapper, restTemplate, fileAccessSigner);

    private Student student;
    private Path createdFile;

    QuizAiGenerationServiceTest() {
        student = new Student();
        student.setStudId(1L);
        student.setStudentNum("owner-num");
    }

    @AfterEach
    void cleanUp() throws IOException {
        if (createdFile != null && Files.exists(createdFile)) {
            Files.delete(createdFile);
        }
    }

    private Note noteWithContent(long noteId, String contentJson) {
        Note note = new Note();
        note.setNoteId(noteId);
        note.setContent(contentJson);
        return note;
    }

    private QuizRequest simpleRequest(List<Long> noteIds) {
        QuizRequest request = new QuizRequest();
        request.setNoteIds(noteIds);
        // generateQuizContent()는 QuizService에서 이미 유효성 검증을 마친 typeCounts가
        // 전달된다고 가정한다. 여기서는 그 전제를 재현하기 위한 최소값만 채운다.
        request.setTypeCounts(Map.of(QuestionType.MULTIPLE_CHOICE, 5));
        return request;
    }

    @Test
    void validateConfigThrowsWhenApiKeyMissing() {
        ReflectionTestUtils.setField(service, "GEMINI_API_KEY", "");

        assertThatThrownBy(service::validateConfig).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void validateConfigPassesWhenApiKeyPresent() {
        ReflectionTestUtils.setField(service, "GEMINI_API_KEY", "some-key");

        service.validateConfig();
    }

    @Test
    void generateQuizContentThrowsExternalServiceExceptionWhenApiCallFails() {
        when(restTemplate.postForObject(anyString(), any(), eq(String.class)))
                .thenThrow(new RestClientException("connection refused"));

        Note note = noteWithContent(1L, "{\"type\":\"doc\",\"content\":[]}");
        QuizRequest request = simpleRequest(List.of(1L));

        assertThatThrownBy(() -> service.generateQuizContent(request, List.of(note), student))
                .isInstanceOf(ExternalServiceException.class);
    }

    @Test
    void generateQuizContentThrowsExternalServiceExceptionWhenResponseIsNotJson() {
        when(restTemplate.postForObject(anyString(), any(), eq(String.class))).thenReturn("not json");

        Note note = noteWithContent(1L, "{\"type\":\"doc\",\"content\":[]}");
        QuizRequest request = simpleRequest(List.of(1L));

        assertThatThrownBy(() -> service.generateQuizContent(request, List.of(note), student))
                .isInstanceOf(ExternalServiceException.class);
    }

    @Test
    void generateQuizContentThrowsExternalServiceExceptionWhenCandidatesAreEmpty() {
        when(restTemplate.postForObject(anyString(), any(), eq(String.class)))
                .thenReturn("{\"candidates\":[]}");

        Note note = noteWithContent(1L, "{\"type\":\"doc\",\"content\":[]}");
        QuizRequest request = simpleRequest(List.of(1L));

        assertThatThrownBy(() -> service.generateQuizContent(request, List.of(note), student))
                .isInstanceOf(ExternalServiceException.class);
    }

    @Test
    void generateQuizContentSucceedsWithWellFormedResponse() throws Exception {
        String innerJson = objectMapper.writeValueAsString(Map.of(
                "title", "제목",
                "difficulty", "NORMAL",
                "questions", List.of()
        ));
        String geminiResponse = objectMapper.writeValueAsString(Map.of(
                "candidates", List.of(Map.of(
                        "content", Map.of(
                                "parts", List.of(Map.of("text", innerJson))
                        )
                ))
        ));
        when(restTemplate.postForObject(anyString(), any(), eq(String.class))).thenReturn(geminiResponse);

        Note note = noteWithContent(1L, "{\"type\":\"doc\",\"content\":[]}");
        QuizRequest request = simpleRequest(List.of(1L));

        QuizResponse response = service.generateQuizContent(request, List.of(note), student);

        assertThat(response.getTitle()).isEqualTo("제목");
        assertThat(response.getQuestions()).isEmpty();
    }

    private String successfulGeminiResponse() throws Exception {
        String innerJson = objectMapper.writeValueAsString(Map.of(
                "title", "제목",
                "difficulty", "NORMAL",
                "questions", List.of()
        ));
        return objectMapper.writeValueAsString(Map.of(
                "candidates", List.of(Map.of(
                        "content", Map.of(
                                "parts", List.of(Map.of("text", innerJson))
                        )
                ))
        ));
    }

    @SuppressWarnings("unchecked")
    private int countInlineMediaPartsInLastRequest() {
        var captor = org.mockito.ArgumentCaptor.forClass(org.springframework.http.HttpEntity.class);
        org.mockito.Mockito.verify(restTemplate).postForObject(anyString(), captor.capture(), eq(String.class));
        Map<String, Object> body = (Map<String, Object>) captor.getValue().getBody();
        List<Map<String, Object>> contents = (List<Map<String, Object>>) body.get("contents");
        List<Map<String, Object>> parts = (List<Map<String, Object>>) contents.get(0).get("parts");
        return (int) parts.stream().filter(p -> p.containsKey("inline_data")).count();
    }

    private String writeTestFile(String content) throws IOException {
        Path dir = Paths.get("uploads");
        if (!Files.exists(dir)) {
            Files.createDirectories(dir);
        }
        String fileName = UUID.randomUUID() + ".png";
        createdFile = dir.resolve(fileName);
        Files.writeString(createdFile, content, StandardCharsets.UTF_8);
        return fileName;
    }

    @Test
    void generateQuizContentSkipsMediaOwnedByAnotherStudent() throws Exception {
        String fileName = writeTestFile("image-bytes");
        // 다른 학생("someone-else")에게 발급된 서명 -> 현재 학생(owner-num) 기준으로는 무효
        String sig = fileAccessSigner.sign(fileName, "someone-else");
        String src = "http://localhost:8080/api/upload/view/" + fileName + "?owner=someone-else&sig=" + sig;

        String contentJson = objectMapper.writeValueAsString(Map.of(
                "type", "doc",
                "content", List.of(Map.of(
                        "type", "image",
                        "attrs", Map.of("src", src)
                ))
        ));
        when(restTemplate.postForObject(anyString(), any(), eq(String.class))).thenReturn(successfulGeminiResponse());

        Note note = noteWithContent(1L, contentJson);
        QuizRequest request = simpleRequest(List.of(1L));

        service.generateQuizContent(request, List.of(note), student);

        assertThat(countInlineMediaPartsInLastRequest()).isZero();
    }

    @Test
    void generateQuizContentIncludesMediaOwnedByCurrentStudent() throws Exception {
        String fileName = writeTestFile("image-bytes");
        String sig = fileAccessSigner.sign(fileName, "owner-num");
        String src = "http://localhost:8080/api/upload/view/" + fileName + "?owner=owner-num&sig=" + sig;

        String contentJson = objectMapper.writeValueAsString(Map.of(
                "type", "doc",
                "content", List.of(Map.of(
                        "type", "image",
                        "attrs", Map.of("src", src)
                ))
        ));
        when(restTemplate.postForObject(anyString(), any(), eq(String.class))).thenReturn(successfulGeminiResponse());

        Note note = noteWithContent(1L, contentJson);
        QuizRequest request = simpleRequest(List.of(1L));

        service.generateQuizContent(request, List.of(note), student);

        assertThat(countInlineMediaPartsInLastRequest()).isEqualTo(1);
    }
}
