package com.uninote.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SecurityConfigTest {

    private SecurityConfig newConfigWithAllowedOrigins(String allowedOrigins, String... activeProfiles) {
        Environment environment = mock(Environment.class);
        when(environment.getActiveProfiles()).thenReturn(activeProfiles);
        SecurityConfig config = new SecurityConfig(mock(JwtFilter.class), environment);
        ReflectionTestUtils.setField(config, "allowedOrigins", allowedOrigins);
        return config;
    }

    private CorsConfiguration corsConfig(SecurityConfig config) {
        UrlBasedCorsConfigurationSource source =
                (UrlBasedCorsConfigurationSource) config.corsConfigurationSource();
        return source.getCorsConfigurations().get("/**");
    }

    @Test
    void defaultAllowedOriginMatchesExistingLocalBehavior() {
        // application.yaml에 값이 없을 때의 기본값과 동일한 동작을 그대로 유지하는지 확인.
        SecurityConfig config = newConfigWithAllowedOrigins("http://localhost:5173", "local");

        CorsConfiguration cors = corsConfig(config);

        assertThat(cors.getAllowedOrigins()).containsExactly("http://localhost:5173");
        assertThat(cors.getAllowCredentials()).isTrue();
    }

    @Test
    void parsesMultipleCommaSeparatedOriginsAndTrimsWhitespace() {
        SecurityConfig config = newConfigWithAllowedOrigins(
                "http://localhost:5173, https://uninote.example.com ,https://staging.uninote.example.com", "local");

        CorsConfiguration cors = corsConfig(config);

        assertThat(cors.getAllowedOrigins()).containsExactly(
                "http://localhost:5173",
                "https://uninote.example.com",
                "https://staging.uninote.example.com");
    }

    @Test
    void ignoresBlankEntriesFromTrailingCommas() {
        SecurityConfig config = newConfigWithAllowedOrigins("http://localhost:5173,", "local");

        CorsConfiguration cors = corsConfig(config);

        assertThat(cors.getAllowedOrigins()).containsExactly("http://localhost:5173");
    }

    @Test
    void nonProdProfileSkipsCorsValidation() {
        SecurityConfig config = newConfigWithAllowedOrigins("", "local");

        config.validateCorsConfigForProd();
    }

    @Test
    void prodProfileWithBlankOriginsFailsFast() {
        SecurityConfig config = newConfigWithAllowedOrigins("", "prod");

        assertThatThrownBy(config::validateCorsConfigForProd)
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void prodProfileWithLocalhostOriginFailsFast() {
        SecurityConfig config = newConfigWithAllowedOrigins("http://localhost:5173", "prod");

        assertThatThrownBy(config::validateCorsConfigForProd)
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void prodProfileWithLoopbackOriginFailsFast() {
        SecurityConfig config = newConfigWithAllowedOrigins("http://127.0.0.1:5173", "prod");

        assertThatThrownBy(config::validateCorsConfigForProd)
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void prodProfileWithValidOriginsPassesValidation() {
        SecurityConfig config = newConfigWithAllowedOrigins("https://uninote.example.com", "prod");

        config.validateCorsConfigForProd();
    }
}
