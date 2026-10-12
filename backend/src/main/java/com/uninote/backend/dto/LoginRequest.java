package com.uninote.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class LoginRequest {
    @NotBlank
    private String studentNum;
    @NotBlank
    private String password;
}
