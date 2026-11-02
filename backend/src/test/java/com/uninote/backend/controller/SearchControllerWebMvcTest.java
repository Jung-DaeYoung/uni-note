package com.uninote.backend.controller;

import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.SearchResponse;
import com.uninote.backend.repository.StudentRepository;
import com.uninote.backend.security.JwtFilter;
import com.uninote.backend.security.JwtUtil;
import com.uninote.backend.security.SecurityConfig;
import com.uninote.backend.service.SearchService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SearchController.class)
@Import({SecurityConfig.class, JwtFilter.class, JwtUtil.class})
@TestPropertySource(properties = {
        "jwt.secret=webmvctest-only-secret-key-needs-at-least-32-bytes-long",
        "jwt.expiration=3600000"
})
class SearchControllerWebMvcTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @MockBean
    private SearchService searchService;

    @MockBean
    private StudentRepository studentRepository;

    @Test
    void 기본값으로_전체_유형을_검색한다() throws Exception {
        Student student = new Student();
        student.setStudentNum("2021001");
        when(studentRepository.getByStudentNum(anyString())).thenReturn(student);
        when(searchService.search(student, "운영체제", "all", null, 0, 20))
                .thenReturn(new SearchResponse("운영체제", List.of()));

        mockMvc.perform(get("/api/search").param("q", "운영체제")
                        .header("Authorization", "Bearer " + jwtUtil.generateToken("2021001")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.query").value("운영체제"));
    }

    @Test
    void 인증없이_요청하면_거부된다() throws Exception {
        mockMvc.perform(get("/api/search").param("q", "운영체제"))
                .andExpect(status().is4xxClientError());
        verify(searchService, never()).search(any(), any(), any(), any(), anyInt(), anyInt());
    }
}
