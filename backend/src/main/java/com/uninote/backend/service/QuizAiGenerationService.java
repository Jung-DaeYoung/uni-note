package com.uninote.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
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
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuizAiGenerationService {
    // 서버 업로드 제한(파일당 10MB)의 2배를 한 번의 퀴즈 생성 요청에 포함될 수 있는
    // 첨부 이미지/PDF 총 용량 상한으로 둔다. AI 호출 페이로드가 지나치게 커지는 것을 막는다.
    private static final long MAX_TOTAL_MEDIA_BYTES = 20L * 1024 * 1024;

    public static final String MODEL_NAME = "gemini-2.5-flash";
    // 생성 결과 로그(quiz.generation)에 남는 prompt·response schema 버전.
    // requestQuiz의 prompt 문자열이나 schema를 바꿀 때마다 올린다.
    public static final String PROMPT_VERSION = "2026-10-03.2";

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final FileAccessSigner fileAccessSigner;

    private final String GEMINI_API_KEY = System.getenv("GEMINI_API_KEY");
    private final String API_URL = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL_NAME
            + ":generateContent?key=" + GEMINI_API_KEY;

    @PostConstruct
    public void validateConfig() {
        if (GEMINI_API_KEY == null || GEMINI_API_KEY.isBlank()) {
            throw new IllegalStateException("GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.");
        }
    }

    // 노트 콘텐츠를 AI 입력(텍스트·미디어)으로 변환하고, 실제로 REF 태그를 붙인 출처 쌍을 모은다.
    // blockScopes는 noteId별 선택 블록이다. 항목이 없는 노트는 전체를, 있는 노트는 해당 blockId
    // 블록(과 그 하위 블록)만 추출한다. blockId는 노트 안에서만 유일하므로 항상 노트 단위로 판정한다.
    public QuizGenerationInput prepareInput(List<Note> notes, Student student, Map<Long, Set<String>> blockScopes) {
        Extraction extraction = new Extraction(student.getStudentNum());

        for (Note note : notes) {
            Set<String> blockScope = blockScopes.get(note.getNoteId());
            extraction.startNote(blockScope);
            if (note.getContent() != null) {
                processNoteContent(note.getNoteId(), note.getContent(), extraction);
            }
            if (blockScope != null && !extraction.foundBlockIds.containsAll(blockScope)) {
                String title = note.getTitle() == null || note.getTitle().isBlank() ? "제목 없음" : note.getTitle();
                throw new InvalidRequestException(
                        "'" + title + "' 노트에서 선택한 블록을 찾을 수 없습니다. 노트가 저장된 뒤 다시 시도해 주세요.");
            }
        }
        return new QuizGenerationInput(extraction.text.toString(), extraction.mediaParts, extraction.allowedSources);
    }

    // 노트 순회 중 누적되는 추출 상태. blockScope·foundBlockIds는 노트마다 새로 시작한다.
    private static final class Extraction {
        final StringBuilder text = new StringBuilder();
        final List<Map<String, Object>> mediaParts = new ArrayList<>();
        final Map<Long, Set<String>> allowedSources = new HashMap<>();
        long totalMediaBytes;
        final String studentNum;
        // 현재 노트의 선택 블록(null이면 노트 전체)과, 선택한 blockId가 저장된 노트에 실제로
        // 있는지 확인하기 위해 모으는 현재 노트의 blockId 집합.
        Set<String> blockScope;
        Set<String> foundBlockIds = new HashSet<>();

        Extraction(String studentNum) {
            this.studentNum = studentNum;
        }

        void startNote(Set<String> noteBlockScope) {
            this.blockScope = noteBlockScope;
            this.foundBlockIds = new HashSet<>();
        }
    }

    // 난이도별 출제 기준(P2-2). 문구를 바꾸면 PROMPT_VERSION을 올린다.
    static String difficultyGuide(QuizDifficulty difficulty) {
        return switch (difficulty) {
            case EASY -> "핵심 용어의 정의나 사실을 떠올리는 문제";
            case NORMAL -> "개념을 설명하거나 두 개념을 비교하는 문제";
            case HARD -> "사례에 개념을 적용하거나, 오류를 찾거나, 여러 개념을 엮어 추론하는 문제";
        };
    }

    public QuizResponse requestQuiz(QuizRequest request, QuizGenerationInput input) {
        String typeInstruction = request.getTypeCounts().entrySet().stream()
            .map(e -> e.getKey() + " " + e.getValue() + "문제")
            .collect(Collectors.joining(", "));

        String prompt = String.format(
            "강의 내용(텍스트, 이미지, PDF)을 기반으로 퀴즈를 생성하라.\n" +
            "텍스트 내용에는 [[REF:noteId/blockId]] 형태의 출처 메타데이터가 포함되어 있다.\n" +
            "모든 문항(question)은 반드시 제공된 출처 중 하나를 근거로 생성해야 하며, 해당 문항의 근거가 된 noteId와 blockId를 'sourceNoteId'와 'sourceBlockId' 필드에 정확히 기입하라.\n" +
            "난이도: %s. 문항은 %s로 출제하라.\n" +
            "유형별 문제 수 배분: %s.\n" +
            "응답 구조: { \"title\": \"제목\", \"difficulty\": \"%s\", \"questions\": [ { \"type\": \"유형\", \"questionText\": \"내용\", \"options\": [\"A\", \"B\"], \"correctAnswer\": \"정답\", \"explanation\": \"해설\", \"sourceNoteId\": 1, \"sourceBlockId\": \"b1\" } ] }.\n" +
            "--- 엄격 준수 사항 ---\n" +
            "1. JSON 응답 내의 어떠한 숫자 값(또는 숫자로 이루어진 문자열)도 500자를 초과할 수 없다.\n" +
            "2. 설명(explanation)이나 정답(correctAnswer)에 불필요하게 긴 숫자 나열, 복잡한 수식, 또는 로우 데이터(raw data)를 포함하지 마라.\n" +
            "3. 텍스트 중심의 간결하고 명확한 설명을 제공하라.\n" +
            "4. 반드시 마크다운 없이 오직 JSON 객체로만 응답하라.\n" +
            // 주관식 채점은 정규화 후 정확 일치라 서술형 정답은 맞힐 수 없다(P2-6 1차).
            "5. 주관식(SHORT_ANSWER) 정답(correctAnswer)은 하나의 단어나 짧은 구(20자 이내)로 하고, 설명이나 서술을 요구하지 마라. 난이도가 높아도 사고 과정은 문제에 담고 정답은 짧게 하라.\n" +
            "텍스트 내용: %s",
            request.getDifficulty(), difficultyGuide(request.getDifficulty()), typeInstruction,
            request.getDifficulty(), input.text()
        );

        List<Map<String, Object>> parts = new ArrayList<>();
        parts.add(Map.of("text", prompt));
        parts.addAll(input.mediaParts());

        // 출처 태그가 하나도 없는 입력(미디어만 있는 노트 등)에서 출처를 필수로 요구하면
        // 모델이 존재하지 않는 출처를 지어내므로, REF를 붙인 경우에만 필수로 둔다.
        List<String> questionRequired = new ArrayList<>(List.of("type", "questionText", "correctAnswer", "explanation"));
        if (!input.allowedSources().isEmpty()) {
            questionRequired.addAll(List.of("sourceNoteId", "sourceBlockId"));
        }

        Map<String, Object> schema = Map.of(
            "type", "OBJECT",
            "properties", Map.of(
                "title", Map.of("type", "STRING"),
                "difficulty", Map.of("type", "STRING", "enum", enumNames(QuizDifficulty.values())),
                "questions", Map.of(
                    "type", "ARRAY",
                    "items", Map.of(
                        "type", "OBJECT",
                        "properties", Map.of(
                            "type", Map.of("type", "STRING", "enum", enumNames(QuestionType.values())),
                            "questionText", Map.of("type", "STRING"),
                            "options", Map.of("type", "ARRAY", "items", Map.of("type", "STRING")),
                            "correctAnswer", Map.of("type", "STRING"),
                            "explanation", Map.of("type", "STRING"),
                            "sourceNoteId", Map.of("type", "NUMBER"),
                            "sourceBlockId", Map.of("type", "STRING")
                        ),
                        "required", questionRequired
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
            throw new ExternalServiceException(ExternalServiceException.AI_RESPONSE_INVALID,
                    "AI 응답을 문제 형식으로 변환하지 못했습니다.");
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
            throw invalidResponse("AI 응답을 해석할 수 없습니다.");
        }

        JsonNode candidates = root.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            throw invalidResponse("AI가 문제를 생성하지 못했습니다.");
        }

        JsonNode parts = candidates.get(0).path("content").path("parts");
        if (!parts.isArray() || parts.isEmpty()) {
            throw invalidResponse("AI 응답 구조가 올바르지 않습니다.");
        }

        String text = parts.get(0).path("text").asText(null);
        if (text == null || text.isBlank()) {
            throw invalidResponse("AI 응답에 문제 내용이 없습니다.");
        }
        return text;
    }

    private static List<String> enumNames(Enum<?>[] values) {
        return Arrays.stream(values).map(Enum::name).toList();
    }

    private ExternalServiceException invalidResponse(String message) {
        return new ExternalServiceException(ExternalServiceException.AI_RESPONSE_INVALID, message);
    }

    // 노트 JSON이 깨져 있으면 해당 노트를 조용히 빼고 생성을 계속하지 않고 요청을 실패시킨다.
    private void processNoteContent(Long noteId, String contentJson, Extraction extraction) {
        JsonNode root;
        try {
            root = objectMapper.readTree(contentJson);
        } catch (Exception e) {
            log.warn("노트 콘텐츠 파싱 실패: noteId={}", noteId, e);
            throw new InvalidRequestException("노트 내용을 읽을 수 없습니다: noteId=" + noteId);
        }
        extractDataFromNode(noteId, null, extraction.blockScope == null, root, extraction);
    }

    // inScope: 이 노드가 추출 범위 안인지. 자기 id가 선택됐거나 조상이 범위 안이면 범위 안이며,
    // 범위 밖 노드는 텍스트·REF·미디어를 넣지 않고 하위 노드만 계속 순회한다.
    private void extractDataFromNode(Long noteId, String currentBlockId, boolean inScope, JsonNode node,
                                     Extraction extraction) {
        if (node.isObject()) {
            String type = node.path("type").asText();
            // id가 null로 저장된 블록은 id가 없는 것으로 보고 부모 블록 id를 물려받는다.
            JsonNode attrs = node.path("attrs");
            String ownId = attrs.hasNonNull("id") ? attrs.path("id").asText() : null;
            String blockId = ownId != null ? ownId : currentBlockId;
            if (ownId != null) {
                extraction.foundBlockIds.add(ownId);
            }
            boolean nodeInScope = inScope || (ownId != null && extraction.blockScope.contains(ownId));

            if (nodeInScope) {
                if ("text".equals(type)) {
                    appendRef(noteId, blockId, "", extraction);
                    extraction.text.append(node.path("text").asText()).append(" ");
                } else if ("image".equals(type)) {
                    appendRef(noteId, blockId, "(Image Content) ", extraction);
                    addMediaPart(attrs.path("src").asText(), "image", extraction);
                } else if ("pdfBlock".equals(type)) {
                    appendRef(noteId, blockId, "(PDF Content) ", extraction);
                    addMediaPart(attrs.path("src").asText(), "application/pdf", extraction);
                }
            }

            JsonNode content = node.path("content");
            if (content.isArray()) {
                for (JsonNode child : content) {
                    extractDataFromNode(noteId, blockId, nodeInScope, child, extraction);
                }
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                extractDataFromNode(noteId, currentBlockId, inScope, child, extraction);
            }
        }
    }

    // blockId가 있을 때만 REF 태그를 붙이고, 같은 쌍을 출처 허용 집합에 기록한다.
    private void appendRef(Long noteId, String blockId, String suffix, Extraction extraction) {
        if (blockId == null) return;
        extraction.text.append("[[REF:").append(noteId).append("/").append(blockId).append("]] ").append(suffix);
        extraction.allowedSources.computeIfAbsent(noteId, k -> new HashSet<>()).add(blockId);
    }

    private void addMediaPart(String url, String defaultMimeType, Extraction extraction) {
        try {
            URI uri = URI.create(url);
            String path = uri.getPath();
            String fileName = path.substring(path.lastIndexOf("/") + 1);

            // 서명(owner/sig)이 있는 URL은 실제로 이 학생에게 발급된 파일인지 확인한다.
            // 서명이 전혀 없는 URL은 서명 도입 이전의 화이트리스트 레거시 파일이므로
            // (P1-1/2단계에서 이미 검토·승인된 잔여 위험) 기존과 동일하게 통과시킨다.
            MultiValueMap<String, String> query = UriComponentsBuilder.fromUri(uri).build().getQueryParams();
            String sig = query.getFirst("sig");
            boolean hasSignature = query.containsKey("owner") || sig != null;
            if (hasSignature && !fileAccessSigner.isValid(fileName, extraction.studentNum, sig)) {
                log.warn("본인 소유가 아닌 파일 참조를 건너뜁니다: {}", fileName);
                return;
            }

            Path filePath = Paths.get("uploads").resolve(fileName);
            if (!Files.exists(filePath)) return;

            extraction.totalMediaBytes += Files.size(filePath);
            if (extraction.totalMediaBytes > MAX_TOTAL_MEDIA_BYTES) {
                throw new InvalidRequestException("첨부된 이미지/PDF의 총 용량이 너무 큽니다.");
            }

            byte[] fileBytes = Files.readAllBytes(filePath);
            String base64Data = Base64.getEncoder().encodeToString(fileBytes);

            String mimeType = defaultMimeType;
            if (fileName.toLowerCase().endsWith(".png")) mimeType = "image/png";
            else if (fileName.toLowerCase().endsWith(".jpg") || fileName.toLowerCase().endsWith(".jpeg")) mimeType = "image/jpeg";
            else if (fileName.toLowerCase().endsWith(".pdf")) mimeType = "application/pdf";

            extraction.mediaParts.add(Map.of(
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
}
