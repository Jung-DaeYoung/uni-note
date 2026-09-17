package com.uninote.backend.exception;

import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void mapsMethodArgumentNotValidExceptionTo400WithFieldErrors() throws NoSuchMethodException {
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new Object(), "request");
        bindingResult.addError(new FieldError("request", "title", "must not be blank"));
        MethodParameter methodParameter = new MethodParameter(
                GlobalExceptionHandlerTest.class.getDeclaredMethod("dummyMethod", String.class), 0);
        MethodArgumentNotValidException ex = new MethodArgumentNotValidException(methodParameter, bindingResult);

        ResponseEntity<ErrorResponse> response = handler.handleValidation(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(400);
        assertThat(response.getBody().errorCode()).isEqualTo("VALIDATION_FAILED");
        assertThat(response.getBody().message()).contains("title").contains("must not be blank");
    }

    @SuppressWarnings("unused")
    private void dummyMethod(String arg) {
    }

    @Test
    void mapsCourseAccessExceptionTo403() {
        ResponseEntity<ErrorResponse> response = handler.handleCourseAccess(
                new CourseAccessException("해당 강의를 수강하지 않습니다."));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(403);
        assertThat(response.getBody().errorCode()).isEqualTo("FORBIDDEN_COURSE_ACCESS");
        assertThat(response.getBody().message()).isEqualTo("해당 강의를 수강하지 않습니다.");
    }

    @Test
    void mapsIllegalArgumentExceptionTo401() {
        ResponseEntity<ErrorResponse> response = handler.handleIllegalArgument(
                new IllegalArgumentException("비밀번호가 일치하지 않습니다."));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(401);
        assertThat(response.getBody().errorCode()).isEqualTo("UNAUTHORIZED");
    }

    @Test
    void mapsResourceNotFoundExceptionTo404() {
        ResponseEntity<ErrorResponse> response = handler.handleResourceNotFound(
                new ResourceNotFoundException("노트를 찾을 수 없습니다."));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(404);
        assertThat(response.getBody().errorCode()).isEqualTo("RESOURCE_NOT_FOUND");
        assertThat(response.getBody().message()).isEqualTo("노트를 찾을 수 없습니다.");
    }

    @Test
    void mapsInvalidRequestExceptionTo400() {
        ResponseEntity<ErrorResponse> response = handler.handleInvalidRequest(
                new InvalidRequestException("그룹 ID 또는 새 그룹 제목이 필요합니다."));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(400);
        assertThat(response.getBody().errorCode()).isEqualTo("INVALID_REQUEST");
    }

    @Test
    void mapsUnexpectedExceptionTo500WithoutLeakingInternalMessage() {
        ResponseEntity<ErrorResponse> response = handler.handleUnexpected(
                new RuntimeException("DB connection string: secret-internal-detail"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(500);
        assertThat(response.getBody().errorCode()).isEqualTo("INTERNAL_SERVER_ERROR");
        assertThat(response.getBody().message()).doesNotContain("secret-internal-detail");
    }
}
