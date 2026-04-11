package com.uninote.backend.exception;

import java.time.LocalDateTime;

public record ErrorResponse(
    LocalDateTime timestamp,
    int status,
    String errorCode,
    String message
) {}
