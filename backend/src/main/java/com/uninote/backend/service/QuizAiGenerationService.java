package com.uninote.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uninote.backend.domain.Note;
import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.QuizRequest;
import com.uninote.backend.dto.QuizResponse;
import com.uninote.backend.exception.ExternalServiceException;
import com.uninote.backend.exception.InvalidRequestException;
import com.uninote.backend.security.FileAccessSigner;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuizAiGenerationService {
    // 서버 업로드 제한(파일당 10MB)의 2배를 한 번의 퀴즈 생성 요청에 포함될 수 있는
    // 첨부 이미지/PDF 총 용량 상한으로 둔다. AI 호출 페이로드가 지나치게 커지는 것을 막는다.
    private static final long MAX_TOTAL_MEDIA_BYTES = 20L * 1024 * 1024;

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final FileAccessSigner fileAccessSigner;

    private final String GEMINI_API_KEY = System.getenv("GEMINI_API_KEY");
    // 원래 모델인 gemini-2.5-flash 사용
    private final String API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_API_KEY;

    @PostConstruct
    public void validateConfig() {
        if (GEMINI_API_KEY == null || GEMINI_API_KEY.isBlank()) {
            throw new IllegalStateException("GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.");
        }
    }

    public QuizResponse generateQuizContent(QuizRequest request, List<Note> notes, Student student) {
        StringBuilder combinedText = new StringBuilder();
        List<Map<String, Object>> mediaParts = new ArrayList<>();
        AtomicLong totalMediaBytes = new AtomicLong(0);

        for (Note note : notes) {
            if (note.getContent() != null) {
                processNoteContent(note.getNoteId(), note.getContent(), combinedText, mediaParts,
                        student.getStudentNum(), totalMediaBytes);
            }
        }

        String typeInstruction = request.getTypeCounts().entrySet().stream()
            .map(e -> e.getKey() + " " + e.getValue() + "문제")
            .collect(Collectors.joining(", "));

        String prompt = String.format(
            "강의 내용(텍스트, 이미지, PDF)을 기반으로 퀴즈를 생성하라.\n" +
            "텍스트 내용에는 [[REF:noteId/blockId]] 형태의 출처 메타데이터가 포함되어 있다.\n" +
            "모든 문항(question)은 반드시 제공된 출처 중 하나를 근거로 생성해야 하며, 해당 문항의 근거가 된 noteId와 blockId를 'sourceNoteId'와 'sourceBlockId' 필드에 정확히 기입하라.\n" +
            "난이도: %s.\n" +
            "유형별 문제 수 배분: %s.\n" +
            "응답 구조: { \"title\": \"제목\", \"difficulty\": \"%s\", \"questions\": [ { \"type\": \"유형\", \"questionText\": \"내용\", \"options\": [\"A\", \"B\"], \"correctAnswer\": \"정답\", \"explanation\": \"해설\", \"sourceNoteId\": 1, \"sourceBlockId\": \"b1\" } ] }.\n" +
            "--- 엄격 준수 사항 ---\n" +
            "1. JSON 응답 내의 어떠한 숫자 값(또는 숫자로 이루어진 문자열)도 500자를 초과할 수 없다.\n" +
            "2. 설명(explanation)이나 정답(correctAnswer)에 불필요하게 긴 숫자 나열, 복잡한 수식, 또는 로우 데이터(raw data)를 포함하지 마라.\n" +
            "3. 텍스트 중심의 간결하고 명확한 설명을 제공하라.\n" +
            "4. 반드시 마크다운 없이 오직 JSON 객체로만 응답하라.\n" +
            "텍스트 내용: %s",
            request.getDifficulty(), typeInstruction, request.getDifficulty(), combinedText.toString()
        );

        List<Map<String, Object>> parts = new ArrayList<>();
        parts.add(Map.of("text", prompt));
        parts.addAll(mediaParts);

        Map<String, Object> schema = Map.of(
            "type", "OBJECT",
            "properties", Map.of(
                "title", Map.of("type", "STRING"),
                "difficulty", Map.of("type", "STRING"),
                "questions", Map.of(
                    "type", "ARRAY",
                    "items", Map.of(
                        "type", "OBJECT",
                        "properties", Map.of(
                            "type", Map.of("type", "STRING"),
                            "questionText", Map.of("type", "STRING"),
                            "options", Map.of("type", "ARRAY", "items", Map.of("type", "STRING")),
                            "correctAnswer", Map.of("type", "STRING"),
                            "explanation", Map.of("type", "STRING"),
                            "sourceNoteId", Map.of("type", "NUMBER"),
                            "sourceBlockId", Map.of("type", "STRING")
                        ),
                        "required", List.of("type", "questionText", "correctAnswer")
                    )
                )
            ),
            "required", List.of("title", "difficulty", "questions")
        );

        Map<String, Object> requestBody = Map.of(
            "contents", List.of(Map.of("parts", parts)),
            "generationConfig", Map.of("responseMimeType", "application/json", "responseSchema", schema)
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        String rawResponse;
        try {
            rawResponse = restTemplate.postForObject(API_URL, entity, String.class);
        } catch (RestClientException e) {
            log.error("AI 퀴즈 생성 API 호출 실패", e);
            throw new ExternalServiceException("AI 퀴즈 생성 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
        }

        String text = extractGeneratedText(rawResponse);

        QuizResponse quizResponse;
        try {
            quizResponse = objectMapper.readValue(text, QuizResponse.class);
        } catch (Exception e) {
            log.error("AI 응답을 문제 형식으로 변환하지 못했습니다.", e);
            throw new ExternalServiceException("AI 응답을 문제 형식으로 변환하지 못했습니다.");
        }
        if (quizResponse.getQuestions() == null) quizResponse.setQuestions(new ArrayList<>());
        return quizResponse;
    }

    // AI가 예상한 구조로 응답했는지 확인한 뒤 실제 생성된 텍스트만 꺼낸다.
    // candidates가 비어 있거나(안전 필터 차단 등) 구조가 다르면 명시적으로 실패시킨다.
    private String extractGeneratedText(String rawResponse) {
        JsonNode root;
        try {
            root = objectMapper.readTree(rawResponse);
        } catch (Exception e) {
            throw new ExternalServiceException("AI 응답을 해석할 수 없습니다.");
        }

        JsonNode candidates = root.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            throw new ExternalServiceException("AI가 문제를 생성하지 못했습니다.");
        }

        JsonNode parts = candidates.get(0).path("content").path("parts");
        if (!parts.isArray() || parts.isEmpty()) {
            throw new ExternalServiceException("AI 응답 구조가 올바르지 않습니다.");
        }

        String text = parts.get(0).path("text").asText(null);
        if (text == null || text.isBlank()) {
            throw new ExternalServiceException("AI 응답에 문제 내용이 없습니다.");
        }
        return text;
    }

    private void processNoteContent(Long noteId, String contentJson, StringBuilder combinedText,
                                     List<Map<String, Object>> mediaParts, String studentNum, AtomicLong totalMediaBytes) {
        try {
            JsonNode root = objectMapper.readTree(contentJson);
            extractDataFromNode(noteId, null, root, combinedText, mediaParts, studentNum, totalMediaBytes);
        } catch (InvalidRequestException e) {
            throw e; // 총 용량 초과 등 요청 자체를 막아야 하는 경우는 그대로 전파한다.
        } catch (Exception e) {
            log.warn("노트 콘텐츠 파싱 실패", e);
        }
    }

    private void extractDataFromNode(Long noteId, String currentBlockId, JsonNode node, StringBuilder textBuilder,
                                      List<Map<String, Object>> mediaParts, String studentNum, AtomicLong totalMediaBytes) {
        if (node.isObject()) {
            String type = node.path("type").asText();
            String blockId = node.path("attrs").has("id") ? node.path("attrs").path("id").asText() : currentBlockId;

            if ("text".equals(type)) {
                if (blockId != null) {
                    textBuilder.append("[[REF:").append(noteId).append("/").append(blockId).append("]] ");
                }
                textBuilder.append(node.path("text").asText()).append(" ");
            } else if ("image".equals(type)) {
                if (blockId != null) {
                    textBuilder.append("[[REF:").append(noteId).append("/").append(blockId).append("]] (Image Content) ");
                }
                String src = node.path("attrs").path("src").asText();
                addMediaPart(src, "image", mediaParts, studentNum, totalMediaBytes);
            } else if ("pdfBlock".equals(type)) {
                if (blockId != null) {
                    textBuilder.append("[[REF:").append(noteId).append("/").append(blockId).append("]] (PDF Content) ");
                }
                String src = node.path("attrs").path("src").asText();
                addMediaPart(src, "application/pdf", mediaParts, studentNum, totalMediaBytes);
            }

            JsonNode content = node.path("content");
            if (content.isArray()) {
                for (JsonNode child : content) {
                    extractDataFromNode(noteId, blockId, child, textBuilder, mediaParts, studentNum, totalMediaBytes);
                }
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                extractDataFromNode(noteId, currentBlockId, child, textBuilder, mediaParts, studentNum, totalMediaBytes);
            }
        }
    }

    private void addMediaPart(String url, String defaultMimeType, List<Map<String, Object>> mediaParts,
                               String studentNum, AtomicLong totalMediaBytes) {
        try {
            URI uri = URI.create(url);
            String path = uri.getPath();
            String fileName = path.substring(path.lastIndexOf("/") + 1);

            // 서명(owner/sig)이 있는 URL은 실제로 이 학생에게 발급된 파일인지 확인한다.
            // 서명이 전혀 없는 URL은 서명 도입 이전의 화이트리스트 레거시 파일이므로
            // (P1-1/2단계에서 이미 검토·승인된 잔여 위험) 기존과 동일하게 통과시킨다.
            Map<String, String> query = parseQuery(uri.getRawQuery());
            String sig = query.get("sig");
            boolean hasSignature = query.containsKey("owner") || sig != null;
            if (hasSignature && !fileAccessSigner.isValid(fileName, studentNum, sig)) {
                log.warn("본인 소유가 아닌 파일 참조를 건너뜁니다: {}", fileName);
                return;
            }

            Path filePath = Paths.get("uploads").resolve(fileName);
            if (!Files.exists(filePath)) return;

            long fileSize = Files.size(filePath);
            if (totalMediaBytes.addAndGet(fileSize) > MAX_TOTAL_MEDIA_BYTES) {
                throw new InvalidRequestException("첨부된 이미지/PDF의 총 용량이 너무 큽니다.");
            }

            byte[] fileBytes = Files.readAllBytes(filePath);
            String base64Data = Base64.getEncoder().encodeToString(fileBytes);

            String mimeType = defaultMimeType;
            if (fileName.toLowerCase().endsWith(".png")) mimeType = "image/png";
            else if (fileName.toLowerCase().endsWith(".jpg") || fileName.toLowerCase().endsWith(".jpeg")) mimeType = "image/jpeg";
            else if (fileName.toLowerCase().endsWith(".pdf")) mimeType = "application/pdf";

            mediaParts.add(Map.of(
                "inline_data", Map.of(
                    "mime_type", mimeType,
                    "data", base64Data
                )
            ));
        } catch (InvalidRequestException e) {
            throw e;
        } catch (Exception e) {
            log.warn("미디어 데이터 변환 실패: " + url, e);
        }
    }

    private Map<String, String> parseQuery(String rawQuery) {
        if (rawQuery == null || rawQuery.isBlank()) return Map.of();
        Map<String, String> result = new HashMap<>();
        for (String pair : rawQuery.split("&")) {
            int idx = pair.indexOf('=');
            if (idx < 0) continue;
            String key = URLDecoder.decode(pair.substring(0, idx), StandardCharsets.UTF_8);
            String value = URLDecoder.decode(pair.substring(idx + 1), StandardCharsets.UTF_8);
            result.put(key, value);
        }
        return result;
    }
}
