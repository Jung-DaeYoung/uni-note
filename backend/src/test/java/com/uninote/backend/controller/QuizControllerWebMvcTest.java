package com.uninote.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uninote.backend.domain.Student;
import com.uninote.backend.repository.StudentRepository;
import com.uninote.backend.security.JwtFilter;
import com.uninote.backend.security.JwtUtil;
import com.uninote.backend.security.SecurityConfig;
import com.uninote.backend.service.QuizService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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

    @Test
    void 음수퀴즈SetID는400을반환한다() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/quiz/-1")
                        .header("Authorization", bearerToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
    }
}
