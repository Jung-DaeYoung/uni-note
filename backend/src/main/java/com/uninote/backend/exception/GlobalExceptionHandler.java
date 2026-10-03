package com.uninote.backend.exception;

import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.time.LocalDateTime;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 수강 권한이 없는 강의 접근 시 발생
    @ExceptionHandler(CourseAccessException.class)
    public ResponseEntity<ErrorResponse> handleCourseAccess(CourseAccessException ex) {
        return respond(HttpStatus.FORBIDDEN, "FORBIDDEN_COURSE_ACCESS", ex.getMessage());
    }

    // 요청한 리소스가 존재하지 않을 때
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException ex) {
        return respond(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", ex.getMessage());
    }

    // AI 등 외부 연동 서비스 호출 실패/비정상 응답
    @ExceptionHandler(ExternalServiceException.class)
    public ResponseEntity<ErrorResponse> handleExternalService(ExternalServiceException ex) {
        log.error("외부 서비스 연동 실패 [{}]: {}", ex.getErrorCode(), ex.getMessage());
        return respond(HttpStatus.SERVICE_UNAVAILABLE, ex.getErrorCode(), ex.getMessage());
    }

    // 요청 형식/내용 자체가 잘못되었을 때
    @ExceptionHandler(InvalidRequestException.class)
    public ResponseEntity<ErrorResponse> handleInvalidRequest(InvalidRequestException ex) {
        return respond(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", ex.getMessage());
    }

    // @Valid로 걸린 요청 DTO의 Bean Validation 실패 (필드별 오류를 하나의 메시지로 합쳐 반환한다)
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return respond(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", message);
    }

    // 업로드 용량 제한(application.yaml의 spring.servlet.multipart.max-file-size) 초과.
    // 컨트롤러에 도달하기 전 멀티파트 파서 단계에서 던져지므로 별도로 잡아줘야 500으로 새지 않는다.
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUploadSizeExceeded(MaxUploadSizeExceededException ex) {
        return respond(HttpStatus.BAD_REQUEST, "FILE_TOO_LARGE", "파일 크기가 허용된 용량을 초과했습니다.");
    }

    // @PathVariable/@RequestParam에 걸린 제약(@Positive 등)의 Bean Validation 실패.
    // @Valid @RequestBody 실패(MethodArgumentNotValidException)와 동일한 형식으로 응답한다.
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(ConstraintViolationException ex) {
        String message = ex.getConstraintViolations().stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .collect(Collectors.joining(", "));
        return respond(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", message);
    }

    // 인증 실패 시 (예: 로그인 실패). 계정 존재 여부를 노출하지 않기 위해 원인과 무관하게 401로 통일한다.
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return respond(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", ex.getMessage());
    }

    // DB 제약(FK 등) 위반으로 요청을 처리할 수 없을 때. 원인 불명의 500 대신 명확한 4xx로
    // 응답하되, SQL 원문 등 내부 정보는 노출하지 않는다.
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(org.springframework.dao.DataIntegrityViolationException ex) {
        log.error("DB 제약 위반으로 요청을 처리하지 못했습니다.", ex);
        return respond(HttpStatus.CONFLICT, "DATA_INTEGRITY_VIOLATION", "다른 데이터와 연결되어 있어 처리할 수 없습니다.");
    }

    // 예기치 않은 예외는 내부 메시지를 노출하지 않고 일반화된 500으로 응답한다.
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex) {
        // 상태 코드를 가진 Spring MVC 예외(없는 경로 404, 허용되지 않은 메서드 405 등)는 500으로 바꾸지 않고
        // 그 상태로 응답한다. @ExceptionHandler는 인터페이스 타입을 받지 않으므로 여기서 분기한다.
        if (ex instanceof org.springframework.web.ErrorResponse webError) {
            HttpStatus status = HttpStatus.valueOf(webError.getStatusCode().value());
            String message = status == HttpStatus.NOT_FOUND ? "요청한 경로를 찾을 수 없습니다."
                    : status == HttpStatus.METHOD_NOT_ALLOWED ? "허용되지 않은 요청 메서드입니다."
                    : "요청을 처리할 수 없습니다.";
            return respond(status, status.name(), message);
        }
        log.error("예기치 않은 예외가 발생했습니다.", ex);
        return respond(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");
    }

    private ResponseEntity<ErrorResponse> respond(HttpStatus status, String errorCode, String message) {
        return ResponseEntity.status(status)
                .body(new ErrorResponse(LocalDateTime.now(), status.value(), errorCode, message));
    }
}
