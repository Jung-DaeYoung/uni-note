package com.uninote.backend.config;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@Configuration
public class RestClientConfig {
    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .connectTimeout(Duration.ofSeconds(5))
                // AI 퀴즈 생성은 최대 약 90초 걸린다. Nginx proxy_read_timeout(120s)과 맞춘다.
                .readTimeout(Duration.ofSeconds(120))
                .build();
    }
}
