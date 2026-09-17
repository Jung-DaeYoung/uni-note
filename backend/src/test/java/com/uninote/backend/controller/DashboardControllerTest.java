package com.uninote.backend.controller;

import com.uninote.backend.dto.DashboardResponse;
import com.uninote.backend.service.DashboardService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DashboardControllerTest {

    private final DashboardService dashboardService = mock(DashboardService.class);
    private final DashboardController dashboardController = new DashboardController(dashboardService);

    @Test
    void getCoursesUsesAuthenticationNameAsStudentNum() {
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("2021001");
        DashboardResponse expected = DashboardResponse.builder().studentName("홍길동").build();
        when(dashboardService.getDashboardData("2021001")).thenReturn(expected);

        ResponseEntity<DashboardResponse> response = dashboardController.getCourses(authentication);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isSameAs(expected);
    }
}
