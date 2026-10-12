package com.uninote.backend.security;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtFilter jwtFilter;
    private final Environment environment;

    // 콤마로 구분된 허용 origin 목록. 프로파일/환경 변수로 배포 환경별 값을 지정할 수 있고,
    // 값이 없으면 기존과 동일하게 로컬 프론트 origin 하나만 허용한다.
    @Value("${cors.allowed-origins:http://localhost:5173}")
    private String allowedOrigins;

    // prod 프로파일에서 cors.allowed-origins가 비어 있거나 localhost/127.0.0.1을 포함하면
    // 조용히 폴백되지 않도록 기동 시점에 명시적으로 실패시킨다.
    @PostConstruct
    public void validateCorsConfigForProd() {
        if (!Arrays.asList(environment.getActiveProfiles()).contains("prod")) {
            return;
        }

        List<String> origins = parseAllowedOrigins();
        if (origins.isEmpty()) {
            throw new IllegalStateException(
                    "cors.allowed-origins가 비어 있습니다. 운영 환경(prod)에서는 CORS_ALLOWED_ORIGINS를 명시적으로 설정해야 합니다.");
        }

        boolean hasLocalOrigin = origins.stream()
                .anyMatch(origin -> origin.toLowerCase().contains("localhost") || origin.contains("127.0.0.1"));
        if (hasLocalOrigin) {
            throw new IllegalStateException(
                    "cors.allowed-origins에 localhost/127.0.0.1을 포함할 수 없습니다(운영 환경): " + origins);
        }
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/api/auth/**", "/error").permitAll()
                // 파일 업로드(POST)는 인증이 필요하다. 파일 서빙(GET)은 <img>/<a>/location
                // 이동처럼 브라우저가 직접 요청해 Authorization 헤더를 못 붙이므로, 인가는
                // ImageUploadController가 URL의 서명(owner/sig) 또는 레거시 화이트리스트로 직접 검증한다.
                // "/uploads/**"는 더 이상 정적 리소스가 아니라 ImageUploadController.viewLegacyFile()로 라우팅된다.
                .requestMatchers(HttpMethod.GET, "/api/upload/view/**", "/api/upload/download/**", "/uploads/**").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowCredentials(true);
        config.setAllowedOrigins(parseAllowedOrigins());
        config.setAllowedHeaders(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    private List<String> parseAllowedOrigins() {
        return Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toList();
    }
}
