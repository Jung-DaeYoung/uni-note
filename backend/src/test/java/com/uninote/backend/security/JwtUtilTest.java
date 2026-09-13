package com.uninote.backend.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtUtilTest {

    private static final String VALID_SECRET = "test_jwt_secret_key_minimum_32_bytes_long";
    private static final long VALID_EXPIRATION = 60_000L;

    @Test
    void generatesAndValidatesTokenPreservingSubject() {
        JwtUtil jwtUtil = new JwtUtil(VALID_SECRET, VALID_EXPIRATION);

        String token = jwtUtil.generateToken("20240001");

        assertThat(jwtUtil.validateToken(token)).isTrue();
        assertThat(jwtUtil.getStudentNum(token)).isEqualTo("20240001");
    }

    @Test
    void rejectsExpiredToken() throws InterruptedException {
        JwtUtil jwtUtil = new JwtUtil(VALID_SECRET, 1L);

        String token = jwtUtil.generateToken("20240001");
        Thread.sleep(10);

        assertThat(jwtUtil.validateToken(token)).isFalse();
    }

    @Test
    void rejectsBlankSecretAtStartup() {
        assertThatThrownBy(() -> new JwtUtil("   ", VALID_EXPIRATION))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rejectsSecretShorterThanHmacRequirement() {
        assertThatThrownBy(() -> new JwtUtil("too_short_secret", VALID_EXPIRATION))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rejectsNonPositiveExpirationAtStartup() {
        assertThatThrownBy(() -> new JwtUtil(VALID_SECRET, 0L))
                .isInstanceOf(IllegalStateException.class);
    }
}
