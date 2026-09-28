package com.uninote.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

// 소요 시간에 따라 동작이 달라지는 로직(AI 퀴즈 재생성 여부 등)을 테스트에서 제어할 수 있도록 주입한다.
@Configuration
public class ClockConfig {
    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
