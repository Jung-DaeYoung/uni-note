package com.uninote.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uninote.backend.domain.Note;
import com.uninote.backend.domain.QuestionType;
import com.uninote.backend.domain.QuizDifficulty;
import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.QuizRequest;
import com.uninote.backend.dto.QuizResponse;
import com.uninote.backend.exception.ExternalServiceException;
import com.uninote.backend.exception.InvalidRequestException;
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
import java.util.Set;
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
        // requestQuiz()는 QuizService에서 이미 유효성 검증을 마친 typeCounts가
        // 전달된다고 가정한다. 여기서는 그 전제를 재현하기 위한 최소값만 채운다.
        request.setTypeCounts(Map.of(QuestionType.MULTIPLE_CHOICE, 5));
        // difficulty는 QuizRequest에서 @NotNull이므로 실제 요청과 같이 채운다.
        request.setDifficulty(QuizDifficulty.NORMAL);
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

    private static final String TEXT_NOTE_JSON =
            "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"attrs\":{\"id\":\"b1\"},"
            + "\"content\":[{\"type\":\"text\",\"text\":\"페이지 교체\"}]}]}";

    private QuizGenerationInput textInput() {
        return service.prepareInput(List.of(noteWithContent(1L, TEXT_NOTE_JSON)), student, Map.of());
    }

    @Test
    void requestQuizThrowsExternalServiceErrorWhenApiCallFails() {
        when(restTemplate.postForObject(anyString(), any(), eq(String.class)))
                .thenThrow(new RestClientException("connection refused"));

        assertThatThrownBy(() -> service.requestQuiz(simpleRequest(List.of(1L)), textInput()))
                .isInstanceOf(ExternalServiceException.class)
                .extracting("errorCode").isEqualTo(ExternalServiceException.EXTERNAL_SERVICE_ERROR);
    }

    @Test
    void requestQuizThrowsAiResponseInvalidWhenResponseIsNotJson() {
        when(restTemplate.postForObject(anyString(), any(), eq(String.class))).thenReturn("not json");

        assertThatThrownBy(() -> service.requestQuiz(simpleRequest(List.of(1L)), textInput()))
                .isInstanceOf(ExternalServiceException.class)
                .extracting("errorCode").isEqualTo(ExternalServiceException.AI_RESPONSE_INVALID);
    }

    @Test
    void requestQuizThrowsAiResponseInvalidWhenCandidatesAreEmpty() {
        when(restTemplate.postForObject(anyString(), any(), eq(String.class)))
                .thenReturn("{\"candidates\":[]}");

        assertThatThrownBy(() -> service.requestQuiz(simpleRequest(List.of(1L)), textInput()))
                .isInstanceOf(ExternalServiceException.class)
                .extracting("errorCode").isEqualTo(ExternalServiceException.AI_RESPONSE_INVALID);
    }

    @Test
    void requestQuizSucceedsWithWellFormedResponse() throws Exception {
        when(restTemplate.postForObject(anyString(), any(), eq(String.class))).thenReturn(successfulGeminiResponse());

        QuizResponse response = service.requestQuiz(simpleRequest(List.of(1L)), textInput());

        assertThat(response.getTitle()).isEqualTo("제목");
        assertThat(response.getQuestions()).isEmpty();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> lastRequestBody() {
        var captor = org.mockito.ArgumentCaptor.forClass(org.springframework.http.HttpEntity.class);
        org.mockito.Mockito.verify(restTemplate).postForObject(anyString(), captor.capture(), eq(String.class));
        return (Map<String, Object>) captor.getValue().getBody();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> lastResponseSchema() {
        Map<String, Object> generationConfig = (Map<String, Object>) lastRequestBody().get("generationConfig");
        return (Map<String, Object>) generationConfig.get("responseSchema");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> questionItemSchema(Map<String, Object> schema) {
        Map<String, Object> properties = (Map<String, Object>) schema.get("properties");
        Map<String, Object> questions = (Map<String, Object>) properties.get("questions");
        return (Map<String, Object>) questions.get("items");
    }

    @Test
    @SuppressWarnings("unchecked")
    void requestQuizSchemaRestrictsEnumsAndRequiresExplanationAndSourcesWhenRefsExist() throws Exception {
        when(restTemplate.postForObject(anyString(), any(), eq(String.class))).thenReturn(successfulGeminiResponse());

        service.requestQuiz(simpleRequest(List.of(1L)), textInput());

        Map<String, Object> schema = lastResponseSchema();
        Map<String, Object> difficulty =
                (Map<String, Object>) ((Map<String, Object>) schema.get("properties")).get("difficulty");
        assertThat(difficulty.get("enum")).isEqualTo(List.of("EASY", "NORMAL", "HARD"));

        Map<String, Object> item = questionItemSchema(schema);
        Map<String, Object> type = (Map<String, Object>) ((Map<String, Object>) item.get("properties")).get("type");
        assertThat(type.get("enum")).isEqualTo(List.of("MULTIPLE_CHOICE", "SHORT_ANSWER", "OX"));
        assertThat((List<String>) item.get("required")).containsExactlyInAnyOrder(
                "type", "questionText", "correctAnswer", "explanation", "sourceNoteId", "sourceBlockId");
    }

    @Test
    @SuppressWarnings("unchecked")
    void requestQuizSchemaDoesNotRequireSourcesWhenInputHasNoRefs() throws Exception {
        when(restTemplate.postForObject(anyString(), any(), eq(String.class))).thenReturn(successfulGeminiResponse());

        service.requestQuiz(simpleRequest(List.of(1L)), new QuizGenerationInput("(Image Content) ", List.of(), Map.of()));

        assertThat((List<String>) questionItemSchema(lastResponseSchema()).get("required"))
                .containsExactlyInAnyOrder("type", "questionText", "correctAnswer", "explanation");
    }

    // prompt 문구가 의도치 않게 바뀌지 않도록 고정한다. 바꿀 때는 PROMPT_VERSION도 함께 올린다.
    @Test
    @SuppressWarnings("unchecked")
    void requestQuizPromptIsUnchanged() throws Exception {
        when(restTemplate.postForObject(anyString(), any(), eq(String.class))).thenReturn(successfulGeminiResponse());
        QuizRequest request = simpleRequest(List.of(1L));
        request.setDifficulty(QuizDifficulty.NORMAL);

        service.requestQuiz(request, textInput());

        List<Map<String, Object>> contents = (List<Map<String, Object>>) lastRequestBody().get("contents");
        List<Map<String, Object>> parts = (List<Map<String, Object>>) contents.get(0).get("parts");
        assertThat(parts.get(0).get("text")).isEqualTo(
                "강의 내용(텍스트, 이미지, PDF)을 기반으로 퀴즈를 생성하라.\n" +
                "텍스트 내용에는 [[REF:noteId/blockId]] 형태의 출처 메타데이터가 포함되어 있다.\n" +
                "모든 문항(question)은 반드시 제공된 출처 중 하나를 근거로 생성해야 하며, 해당 문항의 근거가 된 noteId와 blockId를 'sourceNoteId'와 'sourceBlockId' 필드에 정확히 기입하라.\n" +
                "난이도: NORMAL. 문항은 개념을 설명하거나 두 개념을 비교하는 문제로 출제하라.\n" +
                "유형별 문제 수 배분: MULTIPLE_CHOICE 5문제.\n" +
                "응답 구조: { \"title\": \"제목\", \"difficulty\": \"NORMAL\", \"questions\": [ { \"type\": \"유형\", \"questionText\": \"내용\", \"options\": [\"A\", \"B\"], \"correctAnswer\": \"정답\", \"explanation\": \"해설\", \"sourceNoteId\": 1, \"sourceBlockId\": \"b1\" } ] }.\n" +
                "--- 엄격 준수 사항 ---\n" +
                "1. JSON 응답 내의 어떠한 숫자 값(또는 숫자로 이루어진 문자열)도 500자를 초과할 수 없다.\n" +
                "2. 설명(explanation)이나 정답(correctAnswer)에 불필요하게 긴 숫자 나열, 복잡한 수식, 또는 로우 데이터(raw data)를 포함하지 마라.\n" +
                "3. 텍스트 중심의 간결하고 명확한 설명을 제공하라.\n" +
                "4. 반드시 마크다운 없이 오직 JSON 객체로만 응답하라.\n" +
                "텍스트 내용: [[REF:1/b1]] 페이지 교체 ");
    }

    @Test
    @SuppressWarnings("unchecked")
    void requestQuizPromptIncludesGuideForRequestedDifficulty() throws Exception {
        when(restTemplate.postForObject(anyString(), any(), eq(String.class))).thenReturn(successfulGeminiResponse());

        QuizRequest request = simpleRequest(List.of(1L));
        request.setDifficulty(QuizDifficulty.HARD);
        service.requestQuiz(request, textInput());

        List<Map<String, Object>> contents = (List<Map<String, Object>>) lastRequestBody().get("contents");
        String prompt = (String) ((List<Map<String, Object>>) contents.get(0).get("parts")).get(0).get("text");
        assertThat(prompt).contains("난이도: HARD. 문항은 "
                + "사례에 개념을 적용하거나, 오류를 찾거나, 여러 개념을 엮어 추론하는 문제로 출제하라.");
        assertThat(QuizAiGenerationService.difficultyGuide(QuizDifficulty.EASY)).contains("정의");
        assertThat(QuizAiGenerationService.difficultyGuide(QuizDifficulty.HARD)).contains("추론");
    }

    @Test
    void prepareInputCollectsOnlyReferencedSources() throws Exception {
        String contentJson = objectMapper.writeValueAsString(Map.of(
                "type", "doc",
                "content", List.of(
                        Map.of("type", "paragraph", "attrs", Map.of("id", "b1"),
                                "content", List.of(Map.of("type", "text", "text", "LRU"))),
                        // 텍스트가 없는 블록은 REF 태그가 붙지 않으므로 출처 허용 집합에도 없다.
                        Map.of("type", "paragraph", "attrs", Map.of("id", "empty")),
                        // id가 없는 블록의 텍스트는 REF 없이 들어간다.
                        Map.of("type", "paragraph",
                                "content", List.of(Map.of("type", "text", "text", "FIFO")))
                )
        ));

        QuizGenerationInput input = service.prepareInput(List.of(noteWithContent(7L, contentJson)), student, Map.of());

        assertThat(input.allowedSources()).isEqualTo(Map.of(7L, java.util.Set.of("b1")));
        assertThat(input.text()).contains("[[REF:7/b1]] LRU").contains("FIFO");
        assertThat(input.isEmpty()).isFalse();
    }

    // 제목 heading(t) · 범위 밖 문단(p1) · 리스트(list > item 안의 문단 li1) · 이미지 없는 문단(p2)
    private static final String SCOPED_NOTE_JSON =
            "{\"type\":\"doc\",\"content\":["
            + "{\"type\":\"heading\",\"attrs\":{\"id\":\"t\",\"level\":1},\"content\":[{\"type\":\"text\",\"text\":\"제목\"}]},"
            + "{\"type\":\"paragraph\",\"attrs\":{\"id\":\"p1\"},\"content\":[{\"type\":\"text\",\"text\":\"범위밖문단\"}]},"
            + "{\"type\":\"bulletList\",\"attrs\":{\"id\":\"list\"},\"content\":[{\"type\":\"listItem\",\"content\":["
            + "{\"type\":\"paragraph\",\"attrs\":{\"id\":\"li1\"},\"content\":[{\"type\":\"text\",\"text\":\"리스트항목\"}]}]}]},"
            + "{\"type\":\"paragraph\",\"attrs\":{\"id\":\"p2\"},\"content\":[{\"type\":\"text\",\"text\":\"선택문단\"}]}"
            + "]}";

    @Test
    void prepareInputWithoutScopeExtractsWholeNote() {
        QuizGenerationInput input =
                service.prepareInput(List.of(noteWithContent(5L, SCOPED_NOTE_JSON)), student, Map.of());

        assertThat(input.text()).contains("제목", "범위밖문단", "리스트항목", "선택문단");
        assertThat(input.allowedSources()).isEqualTo(Map.of(5L, Set.of("t", "p1", "li1", "p2")));
    }

    @Test
    void prepareInputWithScopeExtractsOnlySelectedBlocksAndTheirChildren() {
        QuizGenerationInput input = service.prepareInput(
                List.of(noteWithContent(5L, SCOPED_NOTE_JSON)), student, Map.of(5L, Set.of("list", "p2")));

        assertThat(input.text())
                .contains("[[REF:5/li1]] 리스트항목", "[[REF:5/p2]] 선택문단")
                .doesNotContain("제목", "범위밖문단", "REF:5/p1", "REF:5/t");
        // 출처 허용 집합이 곧 선택 범위다(범위 밖 출처는 검증기에서 미검증 처리된다).
        assertThat(input.allowedSources()).isEqualTo(Map.of(5L, Set.of("li1", "p2")));
    }

    @Test
    void prepareInputWithScopeExcludesMediaOutsideScope() throws Exception {
        String fileName = writeTestFile("image-bytes");
        String sig = fileAccessSigner.sign(fileName, "owner-num");
        String src = "http://localhost:8080/api/upload/view/" + fileName + "?owner=owner-num&sig=" + sig;
        String contentJson = objectMapper.writeValueAsString(Map.of(
                "type", "doc",
                "content", List.of(
                        Map.of("type", "image", "attrs", Map.of("id", "img", "src", src)),
                        Map.of("type", "paragraph", "attrs", Map.of("id", "p"),
                                "content", List.of(Map.of("type", "text", "text", "본문")))
                )
        ));

        QuizGenerationInput input =
                service.prepareInput(List.of(noteWithContent(1L, contentJson)), student, Map.of(1L, Set.of("p")));

        assertThat(input.mediaParts()).isEmpty();
        assertThat(input.text()).doesNotContain("Image Content");
    }

    @Test
    void prepareInputRejectsBlockIdMissingFromSavedNoteWithNoteTitle() {
        Note note = noteWithContent(5L, SCOPED_NOTE_JSON);
        note.setTitle("2장 메모리 관리");

        assertThatThrownBy(() -> service.prepareInput(
                List.of(note), student, Map.of(5L, Set.of("p2", "not-saved-yet"))))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("'2장 메모리 관리' 노트에서 선택한 블록을 찾을 수 없습니다");
    }

    @Test
    void prepareInputMixesWholeNotesAndPerNoteBlockScopes() {
        String otherNoteJson = "{\"type\":\"doc\",\"content\":["
                + "{\"type\":\"paragraph\",\"attrs\":{\"id\":\"x1\"},\"content\":[{\"type\":\"text\",\"text\":\"전체노트본문\"}]}]}";

        QuizGenerationInput input = service.prepareInput(
                List.of(noteWithContent(5L, SCOPED_NOTE_JSON), noteWithContent(6L, otherNoteJson)),
                student, Map.of(5L, Set.of("p2")));

        assertThat(input.text())
                .contains("[[REF:5/p2]] 선택문단", "[[REF:6/x1]] 전체노트본문")
                .doesNotContain("범위밖문단", "리스트항목");
        assertThat(input.allowedSources()).isEqualTo(Map.of(5L, Set.of("p2"), 6L, Set.of("x1")));
    }

    @Test
    void prepareInputScopesSameBlockIdPerNote() {
        // 복사·붙여넣기로 두 노트에 같은 blockId(p1)가 있어도 선택한 노트의 블록만 포함된다.
        String otherNoteJson = "{\"type\":\"doc\",\"content\":["
                + "{\"type\":\"paragraph\",\"attrs\":{\"id\":\"p1\"},\"content\":[{\"type\":\"text\",\"text\":\"다른노트문단\"}]},"
                + "{\"type\":\"paragraph\",\"attrs\":{\"id\":\"q\"},\"content\":[{\"type\":\"text\",\"text\":\"다른노트선택\"}]}]}";

        QuizGenerationInput input = service.prepareInput(
                List.of(noteWithContent(5L, SCOPED_NOTE_JSON), noteWithContent(6L, otherNoteJson)),
                student, Map.of(5L, Set.of("p1"), 6L, Set.of("q")));

        assertThat(input.text())
                .contains("[[REF:5/p1]] 범위밖문단", "[[REF:6/q]] 다른노트선택")
                .doesNotContain("다른노트문단");
        assertThat(input.allowedSources()).isEqualTo(Map.of(5L, Set.of("p1"), 6L, Set.of("q")));
    }

    @Test
    void prepareInputTreatsNullBlockIdAsMissing() {
        String contentJson = "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"attrs\":{\"id\":null},"
                + "\"content\":[{\"type\":\"text\",\"text\":\"옛 블록\"}]}]}";

        QuizGenerationInput input = service.prepareInput(List.of(noteWithContent(2L, contentJson)), student, Map.of());

        assertThat(input.text()).contains("옛 블록").doesNotContain("REF:2/null");
        assertThat(input.allowedSources()).isEmpty();
    }

    @Test
    void prepareInputIsEmptyForEmptyDocument() {
        QuizGenerationInput input = service.prepareInput(
                List.of(noteWithContent(1L, "{\"type\":\"doc\",\"content\":[]}")), student, Map.of());

        assertThat(input.isEmpty()).isTrue();
    }

    @Test
    void prepareInputRejectsBrokenNoteJson() {
        assertThatThrownBy(() -> service.prepareInput(List.of(noteWithContent(3L, "{broken")), student, Map.of()))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("noteId=3");
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
        List<Map<String, Object>> contents = (List<Map<String, Object>>) lastRequestBody().get("contents");
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
    void prepareInputSkipsMediaOwnedByAnotherStudent() throws Exception {
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
        QuizGenerationInput input = service.prepareInput(List.of(noteWithContent(1L, contentJson)), student, Map.of());

        assertThat(input.mediaParts()).isEmpty();
    }

    @Test
    void requestQuizIncludesMediaOwnedByCurrentStudent() throws Exception {
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
        QuizGenerationInput input = service.prepareInput(List.of(noteWithContent(1L, contentJson)), student, Map.of());
        when(restTemplate.postForObject(anyString(), any(), eq(String.class))).thenReturn(successfulGeminiResponse());

        service.requestQuiz(simpleRequest(List.of(1L)), input);

        assertThat(countInlineMediaPartsInLastRequest()).isEqualTo(1);
    }
}
