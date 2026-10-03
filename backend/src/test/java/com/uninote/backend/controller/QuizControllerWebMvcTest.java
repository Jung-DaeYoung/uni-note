package com.uninote.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uninote.backend.domain.Student;
import com.uninote.backend.exception.ExternalServiceException;
import com.uninote.backend.exception.TooManyRequestsException;
import com.uninote.backend.repository.StudentRepository;
import com.uninote.backend.security.JwtFilter;
import com.uninote.backend.security.JwtUtil;
import com.uninote.backend.security.SecurityConfig;
import com.uninote.backend.service.QuizService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// QuizAttemptRequest의 중첩 답안(userAnswers) 검증과 QuizRequest의 noteIds/typeCounts
// 원소 단위 검증이 실제 JSON 역직렬화 + @Valid 경로를 거쳐 400/VALIDATION_FAILED로
// 이어지는지 확인한다. 기존 QuizControllerTest는 컨트롤러를 직접 호출해 이 경로를 건너뛴다.
@WebMvcTest(QuizController.class)
@Import({SecurityConfig.class, JwtFilter.class, JwtUtil.class})
@TestPropertySource(properties = {
        "jwt.secret=webmvctest-only-secret-key-needs-at-least-32-bytes-long",
        "jwt.expiration=3600000"
})
class QuizControllerWebMvcTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private QuizService quizService;

    @MockBean
    private StudentRepository studentRepository;

    private String bearerToken() {
        return "Bearer " + jwtUtil.generateToken("2021001");
    }

    @BeforeEach
    void setUp() {
        Student student = new Student();
        student.setStudId(1L);
        student.setStudentNum("2021001");
        when(studentRepository.getByStudentNum(anyString())).thenReturn(student);
    }

    @Test
    void 중첩답안의questionId누락은400과VALIDATION_FAILED를반환한다() throws Exception {
        String body = """
                {
                  "quizSetId": 1,
                  "userAnswers": [
                    { "submittedAnswer": "A" }
                  ]
                }
                """;

        mockMvc.perform(post("/api/quiz/attempts")
                        .header("Authorization", bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("questionId")));
    }

    @Test
    void noteIds에음수ID가있으면400을반환한다() throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("noteIds", java.util.List.of(-1L));
        body.put("typeCounts", Map.of("SHORT_ANSWER", 3));
        body.put("difficulty", "NORMAL");

        mockMvc.perform(post("/api/quiz/generate")
                        .header("Authorization", bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
    }

    @Test
    void typeCounts값이음수이면400을반환한다() throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("noteIds", java.util.List.of(1L));
        body.put("typeCounts", Map.of("SHORT_ANSWER", -1));
        body.put("difficulty", "NORMAL");

        mockMvc.perform(post("/api/quiz/generate")
                        .header("Authorization", bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
    }

    private org.springframework.test.web.servlet.ResultActions generateWithShortAnswerCount(int count) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("noteIds", java.util.List.of(1L));
        body.put("typeCounts", Map.of("SHORT_ANSWER", count));
        body.put("difficulty", "NORMAL");

        return mockMvc.perform(post("/api/quiz/generate")
                .header("Authorization", bearerToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)));
    }

    // 유형당 문항 수는 서비스 제한(1~20)과 같은 범위로 DTO 단계에서 먼저 검증된다.
    @ParameterizedTest
    @ValueSource(ints = {0, 21})
    void typeCounts값이1에서20범위를벗어나면400을반환한다(int count) throws Exception {
        generateWithShortAnswerCount(count)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
        verify(quizService, never()).generateQuiz(any(), any());
    }

    private org.springframework.test.web.servlet.ResultActions generateWithBlockSelection(Map<String, Object> selection)
            throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("noteIds", java.util.List.of(1L, 2L));
        body.put("typeCounts", Map.of("SHORT_ANSWER", 3));
        body.put("difficulty", "NORMAL");
        body.put("blockSelections", java.util.List.of(selection));

        return mockMvc.perform(post("/api/quiz/generate")
                .header("Authorization", bearerToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)));
    }

    private static Map<String, Object> selectionOf(Object noteId, Object blockIds) {
        Map<String, Object> selection = new LinkedHashMap<>();
        selection.put("noteId", noteId);
        selection.put("blockIds", blockIds);
        return selection;
    }

    static java.util.stream.Stream<Map<String, Object>> invalidBlockSelections() {
        return java.util.stream.Stream.of(
                selectionOf(null, java.util.List.of("b1")),
                selectionOf(2L, java.util.List.of()),
                selectionOf(2L, java.util.List.of("b1", " ")),
                selectionOf(2L, java.util.stream.IntStream.range(0, 501).mapToObj(i -> "b" + i).toList())
        );
    }

    // noteId 누락, 빈 blockIds, 빈 문자열 원소, 노트당 500개 초과
    @ParameterizedTest
    @org.junit.jupiter.params.provider.MethodSource("invalidBlockSelections")
    void 잘못된blockSelections는400을반환한다(Map<String, Object> selection) throws Exception {
        generateWithBlockSelection(selection)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
        verify(quizService, never()).generateQuiz(any(), any());
    }

    @Test
    void blockSelections가있는요청은DTO검증을통과한다() throws Exception {
        generateWithBlockSelection(selectionOf(2L, java.util.List.of("b1", "b2"))).andExpect(status().isOk());
        verify(quizService).generateQuiz(any(), any());
    }

    @Test
    void typeCounts값20은DTO검증을통과한다() throws Exception {
        generateWithShortAnswerCount(20).andExpect(status().isOk());
        verify(quizService).generateQuiz(any(), any());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            ExternalServiceException.EXTERNAL_SERVICE_ERROR,
            ExternalServiceException.AI_RESPONSE_INVALID,
            ExternalServiceException.QUIZ_VALIDATION_FAILED
    })
    void AI생성실패는원인별errorCode와503을반환한다(String errorCode) throws Exception {
        when(quizService.generateQuiz(any(), any()))
                .thenThrow(new ExternalServiceException(errorCode, "생성 실패"));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("noteIds", java.util.List.of(1L));
        body.put("typeCounts", Map.of("SHORT_ANSWER", 3));
        body.put("difficulty", "NORMAL");

        mockMvc.perform(post("/api/quiz/generate")
                        .header("Authorization", bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.errorCode").value(errorCode))
                .andExpect(jsonPath("$.message").value("생성 실패"));
    }

    @Test
    void 음수퀴즈SetID는400을반환한다() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/quiz/-1")
                        .header("Authorization", bearerToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
    }

    @Test
    void 없는경로는500이아닌404와NOT_FOUND를반환한다() throws Exception {
        mockMvc.perform(get("/api/nope").header("Authorization", bearerToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value("NOT_FOUND"));
    }

    @Test
    void 허용되지않은메서드는500이아닌405와METHOD_NOT_ALLOWED를반환한다() throws Exception {
        mockMvc.perform(put("/api/quiz/generate").header("Authorization", bearerToken()))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.errorCode").value("METHOD_NOT_ALLOWED"));
    }

    @Test
    void 호출제한에걸리면429와TOO_MANY_REQUESTS를반환한다() throws Exception {
        when(quizService.generateQuiz(any(), any()))
                .thenThrow(new TooManyRequestsException("이미 문제를 생성하고 있습니다. 완료된 뒤 다시 시도해 주세요."));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("noteIds", java.util.List.of(1L));
        body.put("typeCounts", Map.of("SHORT_ANSWER", 3));
        body.put("difficulty", "NORMAL");

        mockMvc.perform(post("/api/quiz/generate")
                        .header("Authorization", bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.errorCode").value("TOO_MANY_REQUESTS"))
                .andExpect(jsonPath("$.message").value("이미 문제를 생성하고 있습니다. 완료된 뒤 다시 시도해 주세요."));
    }
}
