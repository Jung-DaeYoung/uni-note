package com.uninote.backend.exception;

// AI 등 외부 연동 서비스 호출이 실패했거나 예상한 응답 구조가 아닐 때 사용한다.
public class ExternalServiceException extends RuntimeException {
    public ExternalServiceException(String message) {
        super(message);
    }
}
