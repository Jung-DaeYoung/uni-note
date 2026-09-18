package com.uninote.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uninote.backend.dto.NoteRequest;
import com.uninote.backend.dto.NoteResponse;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.exception.ResourceNotFoundException;
import com.uninote.backend.security.JwtFilter;
import com.uninote.backend.security.JwtUtil;
import com.uninote.backend.security.SecurityConfig;
import com.uninote.backend.service.NoteService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// 실제 Spring MVC 파이프라인(@Valid, JSON 역직렬화, 보안 필터, 예외 변환)을 태워서
// NoteController를 검증한다. 기존 NoteControllerTest는 컨트롤러를 직접 호출하는
// 단위 테스트라 이 경로들을 전혀 거치지 않는다.
@WebMvcTest(NoteController.class)
@Import({SecurityConfig.class, JwtFilter.class, JwtUtil.class})
@TestPropertySource(properties = {
        "jwt.secret=webmvctest-only-secret-key-needs-at-least-32-bytes-long",
        "jwt.expiration=3600000"
})
class NoteControllerWebMvcTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private NoteService noteService;

    private String bearerToken() {
        return "Bearer " + jwtUtil.generateToken("2021001");
    }

    // 실제로는 401이 아니라 403이다: SecurityConfig에 별도 AuthenticationEntryPoint가 없어
    // 인증되지 않은 요청은 Spring Security 기본값인 403으로 떨어지고, GlobalExceptionHandler를
    // 거치지 않으므로 본문도 우리 ErrorResponse 형식이 아니다. (프론트 axios 인터셉터는
    // status===401만 logout으로 처리하므로, 토큰 만료/누락 시 실제로는 로그아웃되지 않는다 —
    // 별도 확인이 필요한 기존 동작이며 이 테스트는 현재 동작을 그대로 고정한다.)
    @Test
    void 인증되지않은요청은403을반환한다() throws Exception {
        mockMvc.perform(get("/api/notes/1"))
                .andExpect(status().isForbidden());
    }

    @Test
    void 다른학생의노트접근은403을반환한다() throws Exception {
        when(noteService.getNote(eq(1L), any())).thenThrow(new CourseAccessException("본인 노트만 접근할 수 있습니다."));

        mockMvc.perform(get("/api/notes/1").header("Authorization", bearerToken()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("FORBIDDEN_COURSE_ACCESS"));
    }

    @Test
    void 존재하지않는노트는404를반환한다() throws Exception {
        when(noteService.getNote(eq(999L), any())).thenThrow(new ResourceNotFoundException("노트를 찾을 수 없습니다."));

        mockMvc.perform(get("/api/notes/999").header("Authorization", bearerToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    void 음수노트ID는400을반환한다() throws Exception {
        mockMvc.perform(get("/api/notes/-1").header("Authorization", bearerToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
    }

    @Test
    void 제목이빈요청은400과VALIDATION_FAILED를반환한다() throws Exception {
        NoteRequest blankTitle = new NoteRequest("", "내용", null, null);

        mockMvc.perform(put("/api/notes/1")
                        .header("Authorization", bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(blankTitle)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("title")));
    }

    @Test
    void 제목이200자를초과하면400을반환한다() throws Exception {
        NoteRequest tooLongTitle = new NoteRequest("가".repeat(201), "내용", null, null);

        mockMvc.perform(put("/api/notes/1")
                        .header("Authorization", bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(tooLongTitle)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
    }

    @Test
    void 정상요청은200과응답본문을반환한다() throws Exception {
        NoteRequest request = new NoteRequest("제목", "내용", "미리보기", "검색용");
        NoteResponse response = NoteResponse.builder().noteId(1L).title("제목").build();
        when(noteService.saveNote(eq(1L), any(), any())).thenReturn(response);

        mockMvc.perform(put("/api/notes/1")
                        .header("Authorization", bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("제목"));
    }
}
