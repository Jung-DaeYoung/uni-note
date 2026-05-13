package com.uninote.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uninote.backend.domain.*;
import com.uninote.backend.dto.*;
import com.uninote.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuizService {
    private final NoteRepository noteRepository;
    private final QuizSetRepository quizSetRepository;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    private final String GEMINI_API_KEY = System.getenv("GEMINI_API_KEY");
    // 원래 모델인 gemini-2.5-flash 사용
    private final String API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_API_KEY;

    @Transactional
    public QuizResponse generateQuiz(QuizRequest request, Student student) {
        List<Note> notes = noteRepository.findAllById(request.getNoteIds());
        
        StringBuilder combinedText = new StringBuilder();
        List<Map<String, Object>> mediaParts = new ArrayList<>();

        for (Note note : notes) {
            if (note.getContent() != null) {
                processNoteContent(note.getContent(), combinedText, mediaParts);
            }
        }

        String typeInstruction = request.getTypeCounts().entrySet().stream()
            .map(e -> e.getKey() + " " + e.getValue() + "문제")
            .collect(Collectors.joining(", "));

        String prompt = String.format(
            "강의 내용(텍스트, 이미지, PDF)을 기반으로 퀴즈를 생성하라.\n" +
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

        try {
            String rawResponse = restTemplate.postForObject(API_URL, entity, String.class);
            JsonNode root = objectMapper.readTree(rawResponse);
            String text = root.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();
            
            QuizResponse quizResponse = objectMapper.readValue(text, QuizResponse.class);
            if (quizResponse.getQuestions() == null) quizResponse.setQuestions(new ArrayList<>());

            if (!quizResponse.getQuestions().isEmpty()) {
                QuizSet quizSet = new QuizSet();
                quizSet.setTitle(quizResponse.getTitle());
                quizSet.setDifficulty(request.getDifficulty());
                quizSet.setSourceNotes(objectMapper.writeValueAsString(request.getNoteIds()));
                quizSet.setStudent(student);
                
                if (!notes.isEmpty()) {
                    quizSet.setCourse(notes.get(0).getCourse());
                }
                
                quizSetRepository.save(quizSet);

                for (QuestionResponse qr : quizResponse.getQuestions()) {
                    Question question = new Question();
                    question.setQuizSet(quizSet);
                    question.setType(qr.getType());
                    question.setQuestionText(qr.getQuestionText());
                    question.setOptions(objectMapper.writeValueAsString(qr.getOptions()));
                    question.setCorrectAnswer(qr.getCorrectAnswer());
                    question.setExplanation(qr.getExplanation());
                    question.setSourceNoteId(qr.getSourceNoteId());
                    question.setSourceBlockId(qr.getSourceBlockId());
                    quizSet.getQuestions().add(question);
                }
            }
            return quizResponse;
        } catch (Exception e) {
            log.error("AI 퀴즈 처리 실패", e);
            throw new RuntimeException("퀴즈 생성 실패: " + e.getMessage());
        }
    }

    private void processNoteContent(String contentJson, StringBuilder combinedText, List<Map<String, Object>> mediaParts) {
        try {
            JsonNode root = objectMapper.readTree(contentJson);
            extractDataFromNode(root, combinedText, mediaParts);
        } catch (Exception e) {
            log.warn("노트 콘텐츠 파싱 실패", e);
        }
    }

    private void extractDataFromNode(JsonNode node, StringBuilder textBuilder, List<Map<String, Object>> mediaParts) {
        if (node.isObject()) {
            String type = node.path("type").asText();
            
            if ("text".equals(type)) {
                textBuilder.append(node.path("text").asText()).append(" ");
            } else if ("image".equals(type)) {
                String src = node.path("attrs").path("src").asText();
                addMediaPart(src, "image", mediaParts);
            } else if ("pdfBlock".equals(type)) {
                String src = node.path("attrs").path("src").asText();
                addMediaPart(src, "application/pdf", mediaParts);
            }

            JsonNode content = node.path("content");
            if (content.isArray()) {
                for (JsonNode child : content) {
                    extractDataFromNode(child, textBuilder, mediaParts);
                }
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                extractDataFromNode(child, textBuilder, mediaParts);
            }
        }
    }

    private void addMediaPart(String url, String defaultMimeType, List<Map<String, Object>> mediaParts) {
        try {
            String fileName = url.substring(url.lastIndexOf("/") + 1);
            Path filePath = Paths.get("uploads").resolve(fileName);
            
            if (Files.exists(filePath)) {
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
            }
        } catch (Exception e) {
            log.warn("미디어 데이터 변환 실패: " + url, e);
        }
    }

    @Transactional
    public void deleteQuiz(Long quizSetId, Student student) {
        QuizSet quizSet = quizSetRepository.findById(quizSetId)
            .orElseThrow(() -> new RuntimeException("퀴즈를 찾을 수 없습니다."));
        
        if (!quizSet.getStudent().getStudId().equals(student.getStudId())) {
            throw new RuntimeException("삭제 권한이 없습니다.");
        }
        
        quizSetRepository.delete(quizSet);
    }

    @Transactional(readOnly = true)
    public List<QuizSetResponse> getMyQuizzes(Student student) {
        return quizSetRepository.findByStudent_StudId(student.getStudId()).stream()
            .map(qs -> QuizSetResponse.builder()
                .quizSetId(qs.getQuizSetId())
                .title(qs.getTitle())
                .courseName(qs.getCourse() != null ? qs.getCourse().getCourseName() : "Unknown Course")
                .difficulty(qs.getDifficulty())
                .createdAt(qs.getCreatedAt())
                .build())
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public QuizSetDetailResponse getQuizDetail(Long quizSetId) {
        QuizSet quizSet = quizSetRepository.findById(quizSetId)
            .orElseThrow(() -> new RuntimeException("퀴즈를 찾을 수 없습니다."));

        List<QuestionResponse> questions = quizSet.getQuestions().stream()
            .map(q -> {
                QuestionResponse qr = new QuestionResponse();
                qr.setType(q.getType());
                qr.setQuestionText(q.getQuestionText());
                try {
                    qr.setOptions(objectMapper.readValue(q.getOptions(), List.class));
                } catch (Exception e) {
                    qr.setOptions(new ArrayList<>());
                }
                qr.setCorrectAnswer(q.getCorrectAnswer());
                qr.setExplanation(q.getExplanation());
                qr.setSourceNoteId(q.getSourceNoteId());
                qr.setSourceBlockId(q.getSourceBlockId());
                return qr;
            })
            .collect(Collectors.toList());

        return QuizSetDetailResponse.builder()
            .quizSetId(quizSet.getQuizSetId())
            .title(quizSet.getTitle())
            .difficulty(quizSet.getDifficulty())
            .questions(questions)
            .build();
    }
}
