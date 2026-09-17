package com.uninote.backend.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 수강 권한이 없는 강의 접근 시 발생
    @ExceptionHandler(CourseAccessException.class)
    public ResponseEntity<ErrorResponse> handleCourseAccess(CourseAccessException ex) {
        ErrorResponse error = new ErrorResponse(
            LocalDateTime.now(),
            HttpStatus.FORBIDDEN.value(),
            "FORBIDDEN_COURSE_ACCESS",
            ex.getMessage()
        );
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error);
    }

    // 요청한 리소스가 존재하지 않을 때
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException ex) {
        ErrorResponse error = new ErrorResponse(
            LocalDateTime.now(),
            HttpStatus.NOT_FOUND.value(),
            "RESOURCE_NOT_FOUND",
            ex.getMessage()
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
    }

    // AI 등 외부 연동 서비스 호출 실패/비정상 응답
    @ExceptionHandler(ExternalServiceException.class)
    public ResponseEntity<ErrorResponse> handleExternalService(ExternalServiceException ex) {
        log.error("외부 서비스 연동 실패: {}", ex.getMessage());
        ErrorResponse error = new ErrorResponse(
            LocalDateTime.now(),
            HttpStatus.SERVICE_UNAVAILABLE.value(),
            "EXTERNAL_SERVICE_ERROR",
            ex.getMessage()
        );
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(error);
    }

    // 요청 형식/내용 자체가 잘못되었을 때
    @ExceptionHandler(InvalidRequestException.class)
    public ResponseEntity<ErrorResponse> handleInvalidRequest(InvalidRequestException ex) {
        ErrorResponse error = new ErrorResponse(
            LocalDateTime.now(),
            HttpStatus.BAD_REQUEST.value(),
            "INVALID_REQUEST",
            ex.getMessage()
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    // @Valid로 걸린 요청 DTO의 Bean Validation 실패 (필드별 오류를 하나의 메시지로 합쳐 반환한다)
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .collect(Collectors.joining(", "));
        ErrorResponse error = new ErrorResponse(
            LocalDateTime.now(),
            HttpStatus.BAD_REQUEST.value(),
            "VALIDATION_FAILED",
            message
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    // 인증 실패 시 (예: 로그인 실패). 계정 존재 여부를 노출하지 않기 위해 원인과 무관하게 401로 통일한다.
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        ErrorResponse error = new ErrorResponse(
            LocalDateTime.now(),
            HttpStatus.UNAUTHORIZED.value(),
            "UNAUTHORIZED",
            ex.getMessage()
        );
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
    }

    // 예기치 않은 예외는 내부 메시지를 노출하지 않고 일반화된 500으로 응답한다.
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex) {
        log.error("예기치 않은 예외가 발생했습니다.", ex);
        ErrorResponse error = new ErrorResponse(
            LocalDateTime.now(),
            HttpStatus.INTERNAL_SERVER_ERROR.value(),
            "INTERNAL_SERVER_ERROR",
            "서버 내부 오류가 발생했습니다."
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }
}
