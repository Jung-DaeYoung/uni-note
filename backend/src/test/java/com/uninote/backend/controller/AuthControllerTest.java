package com.uninote.backend.controller;

import com.uninote.backend.dto.LoginRequest;
import com.uninote.backend.dto.LoginResponse;
import com.uninote.backend.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthControllerTest {

    private final AuthService authService = mock(AuthService.class);
    private final AuthController authController = new AuthController(authService);

    @Test
    void loginDelegatesToAuthServiceAndReturnsTokenWithStudentNum() {
        LoginRequest request = new LoginRequest();
        request.setStudentNum("2021001");
        request.setPassword("password123");
        when(authService.login(request)).thenReturn("jwt-token");

        ResponseEntity<LoginResponse> response = authController.login(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getToken()).isEqualTo("jwt-token");
        assertThat(response.getBody().getStudentNum()).isEqualTo("2021001");
    }
}
