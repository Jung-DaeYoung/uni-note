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
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuizService {
    private final NoteRepository noteRepository;
    private final QuizSetRepository quizSetRepository;
    private final QuizAttemptRepository quizAttemptRepository;
    private final UserAnswerRepository userAnswerRepository;
    private final QuestionRepository questionRepository;
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
                processNoteContent(note.getNoteId(), note.getContent(), combinedText, mediaParts);
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
                    
                    Question savedQuestion = questionRepository.save(question);
                    qr.setQuestionId(savedQuestion.getQuestionId()); // ID 주입
                    quizSet.getQuestions().add(savedQuestion);
                }
                quizResponse.setQuizSetId(quizSet.getQuizSetId()); // QuizResponse에도 ID 추가 필요
            }
            return quizResponse;
        } catch (Exception e) {
            log.error("AI 퀴즈 처리 실패", e);
            throw new RuntimeException("퀴즈 생성 실패: " + e.getMessage());
        }
    }

    private void processNoteContent(Long noteId, String contentJson, StringBuilder combinedText, List<Map<String, Object>> mediaParts) {
        try {
            JsonNode root = objectMapper.readTree(contentJson);
            extractDataFromNode(noteId, null, root, combinedText, mediaParts);
        } catch (Exception e) {
            log.warn("노트 콘텐츠 파싱 실패", e);
        }
    }

    private void extractDataFromNode(Long noteId, String currentBlockId, JsonNode node, StringBuilder textBuilder, List<Map<String, Object>> mediaParts) {
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
                addMediaPart(src, "image", mediaParts);
            } else if ("pdfBlock".equals(type)) {
                if (blockId != null) {
                    textBuilder.append("[[REF:").append(noteId).append("/").append(blockId).append("]] (PDF Content) ");
                }
                String src = node.path("attrs").path("src").asText();
                addMediaPart(src, "application/pdf", mediaParts);
            }

            JsonNode content = node.path("content");
            if (content.isArray()) {
                for (JsonNode child : content) {
                    extractDataFromNode(noteId, blockId, child, textBuilder, mediaParts);
                }
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                extractDataFromNode(noteId, currentBlockId, child, textBuilder, mediaParts);
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
                .courseId(qs.getCourse() != null ? qs.getCourse().getCourseId() : null)
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
                qr.setQuestionId(q.getQuestionId()); // questionId 추가
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

    @Transactional
    public void saveAttempt(QuizAttemptRequest request, Student student) {
        QuizSet quizSet = quizSetRepository.findById(request.getQuizSetId())
            .orElseThrow(() -> new RuntimeException("퀴즈를 찾을 수 없습니다."));

        QuizAttempt attempt = new QuizAttempt();
        attempt.setQuizSet(quizSet);
        attempt.setStudent(student);
        attempt.setScore(request.getScore());
        attempt.setStatus(QuizStatus.COMPLETED);
        attempt.setStartTime(LocalDateTime.now()); // 수동 설정
        attempt.setEndTime(LocalDateTime.now());
        
        quizAttemptRepository.save(attempt);

        for (QuizAttemptRequest.UserAnswerRequest uar : request.getUserAnswers()) {
            Question question = questionRepository.findById(uar.getQuestionId())
                .orElseThrow(() -> new RuntimeException("문제를 찾을 수 없습니다."));
            
            UserAnswer userAnswer = new UserAnswer();
            userAnswer.setQuizAttempt(attempt);
            userAnswer.setQuestion(question);
            userAnswer.setSubmittedAnswer(uar.getSubmittedAnswer());
            userAnswer.setIsCorrect(uar.getIsCorrect());
            userAnswerRepository.save(userAnswer);
        }
    }

    @Transactional(readOnly = true)
    public List<QuizAttemptResponse> getMyAttempts(Student student) {
        return quizAttemptRepository.findByStudent_StudId(student.getStudId()).stream()
            .map(a -> QuizAttemptResponse.builder()
                .attemptId(a.getAttemptId())
                .quizSetId(a.getQuizSet().getQuizSetId())
                .courseId(a.getQuizSet().getCourse() != null ? a.getQuizSet().getCourse().getCourseId() : null)
                .quizTitle(a.getQuizSet().getTitle())
                .score(a.getScore())
                .totalQuestions(a.getQuizSet().getQuestions() != null ? a.getQuizSet().getQuestions().size() : 0)
                .createdAt(a.getStartTime() != null ? a.getStartTime() : LocalDateTime.now()) // Null 방어
                .build())
            .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt())) // 안전한 정렬
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public QuizAttemptDetailResponse getAttemptDetail(Long attemptId) {
        QuizAttempt attempt = quizAttemptRepository.findById(attemptId)
            .orElseThrow(() -> new RuntimeException("기록을 찾을 수 없습니다."));

        List<QuizAttemptDetailResponse.UserAnswerDetailResponse> answers = attempt.getUserAnswers().stream()
            .map(ua -> {
                Question q = ua.getQuestion();
                QuestionResponse qr = new QuestionResponse();
                if (q != null) {
                    qr.setQuestionId(q.getQuestionId());
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
                } else {
                    qr.setQuestionText("(삭제된 문항입니다)");
                    qr.setOptions(new ArrayList<>());
                    qr.setCorrectAnswer("-");
                }

                return QuizAttemptDetailResponse.UserAnswerDetailResponse.builder()
                    .question(qr)
                    .submittedAnswer(ua.getSubmittedAnswer())
                    .isCorrect(ua.getIsCorrect())
                    .build();
            })
            .collect(Collectors.toList());

        return QuizAttemptDetailResponse.builder()
            .attemptId(attempt.getAttemptId())
            .quizSetId(attempt.getQuizSet().getQuizSetId())
            .courseId(attempt.getQuizSet().getCourse() != null ? attempt.getQuizSet().getCourse().getCourseId() : null)
            .quizTitle(attempt.getQuizSet().getTitle())
            .difficulty(attempt.getQuizSet().getDifficulty() != null ? attempt.getQuizSet().getDifficulty().name() : "NORMAL")
            .score(attempt.getScore())
            .createdAt(attempt.getStartTime())
            .userAnswers(answers)
            .build();
    }

    @Transactional(readOnly = true)
    public List<QuizAttemptResponse> getAttemptsByQuizSet(Long quizSetId, Student student) {
        return quizAttemptRepository.findByQuizSet_QuizSetIdAndStudent_StudId(quizSetId, student.getStudId()).stream()
            .map(a -> QuizAttemptResponse.builder()
                .attemptId(a.getAttemptId())
                .quizSetId(a.getQuizSet().getQuizSetId())
                .courseId(a.getQuizSet().getCourse() != null ? a.getQuizSet().getCourse().getCourseId() : null)
                .quizTitle(a.getQuizSet().getTitle())
                .score(a.getScore())
                .totalQuestions(a.getQuizSet().getQuestions() != null ? a.getQuizSet().getQuestions().size() : 0)
                .createdAt(a.getStartTime() != null ? a.getStartTime() : LocalDateTime.now())
                .build())
            .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
            .collect(Collectors.toList());
    }

    public QuestionResponse getQuestionResponse(Question q) {
        QuestionResponse qr = new QuestionResponse();
        qr.setQuestionId(q.getQuestionId());
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
    }
}
