package com.uninote.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uninote.backend.domain.Student;
import com.uninote.backend.repository.StudentRepository;
import com.uninote.backend.security.JwtFilter;
import com.uninote.backend.security.JwtUtil;
import com.uninote.backend.security.SecurityConfig;
import com.uninote.backend.service.KeywordService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(KeywordController.class)
@Import({SecurityConfig.class, JwtFilter.class, JwtUtil.class})
@TestPropertySource(properties = {
        "jwt.secret=webmvctest-only-secret-key-needs-at-least-32-bytes-long",
        "jwt.expiration=3600000"
})
class KeywordControllerWebMvcTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private KeywordService keywordService;

    @MockBean
    private StudentRepository studentRepository;

    @BeforeEach
    void setUp() {
        Student student = new Student();
        student.setStudId(1L);
        student.setStudentNum("2021001");
        when(studentRepository.getByStudentNum(anyString())).thenReturn(student);
    }

    private ResultActions explain(String keyword, String context) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("keyword", keyword);
        body.put("context", context);
        return mockMvc.perform(post("/api/keywords/explain")
                .header("Authorization", "Bearer " + jwtUtil.generateToken("2021001"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)));
    }

    @Test
    void 키워드가비었거나80자를넘거나문맥이2000자를넘으면400을반환한다() throws Exception {
        for (String[] invalid : new String[][]{{" ", null}, {"a".repeat(81), null}, {"JWT", "a".repeat(2001)}}) {
            explain(invalid[0], invalid[1])
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
        }
        verify(keywordService, never()).explain(any(), any());
    }

    @Test
    void 키워드80자와문맥2000자는DTO검증을통과한다() throws Exception {
        explain("a".repeat(80), "a".repeat(2000)).andExpect(status().isOk());
        verify(keywordService).explain(any(), any());
    }

    @Test
    void 인증없이요청하면거부된다() throws Exception {
        mockMvc.perform(post("/api/keywords/explain")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"keyword\":\"JWT\"}"))
                .andExpect(status().is4xxClientError());
        verify(keywordService, never()).explain(any(), any());
    }
}
