package com.uninote.backend.controller;

import com.uninote.backend.dto.DashboardResponse;
import com.uninote.backend.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/courses")
    public ResponseEntity<DashboardResponse> getCourses(Authentication authentication) {
        // JWT 필터에서 Authentication 객체에 저장된 studentNum(학번)을 가져옵니다.
        String studentNum = authentication.getName();
        DashboardResponse dashboardData = dashboardService.getDashboardData(studentNum);
        return ResponseEntity.ok(dashboardData);
    }
}
