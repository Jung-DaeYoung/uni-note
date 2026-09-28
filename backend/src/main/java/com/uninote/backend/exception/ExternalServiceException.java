package com.uninote.backend.exception;

import lombok.Getter;

// AI 등 외부 연동 서비스 호출이 실패했거나 예상한 응답 구조가 아닐 때 사용한다.
// errorCode로 실패 원인(호출 실패 / 응답 해석 실패 / 생성 결과 검증 실패)을 구분하며,
// HTTP 상태는 원인과 무관하게 503으로 동일하다(GlobalExceptionHandler).
@Getter
public class ExternalServiceException extends RuntimeException {
    public static final String EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR";
    public static final String AI_RESPONSE_INVALID = "AI_RESPONSE_INVALID";
    public static final String QUIZ_VALIDATION_FAILED = "QUIZ_VALIDATION_FAILED";

    private final String errorCode;

    public ExternalServiceException(String message) {
        this(EXTERNAL_SERVICE_ERROR, message);
    }

    public ExternalServiceException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}
