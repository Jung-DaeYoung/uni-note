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
                // AI 퀴즈 생성은 응답까지 수십 초가 걸릴 수 있어 read timeout을 넉넉하게 둔다.
                .readTimeout(Duration.ofSeconds(60))
                .build();
    }
}
