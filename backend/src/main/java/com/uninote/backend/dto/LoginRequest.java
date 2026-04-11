package com.uninote.backend.dto;

import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class LoginRequest {
    private String studentNum;
    private String password;
}
