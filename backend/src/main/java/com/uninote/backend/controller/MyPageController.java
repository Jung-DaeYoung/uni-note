package com.uninote.backend.controller;

import com.uninote.backend.dto.MyPageResponse;
import com.uninote.backend.service.MyPageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mypage")
@RequiredArgsConstructor
public class MyPageController {

    private final MyPageService myPageService;

    // 인증된 학번(JWT principal)의 데이터만 조회한다.
    @GetMapping
    public ResponseEntity<MyPageResponse> getMyPage(Authentication authentication) {
        return ResponseEntity.ok(myPageService.getMyPage(authentication.getName()));
    }
}
