package com.uninote.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

// BackendApplication(@SpringBootApplication)에 직접 붙어 있으면 @WebMvcTest가 이 클래스를
// 컨텍스트 루트로 사용할 때 JPA를 전혀 로드하지 않는 슬라이스에서도 jpaAuditingHandler를
// 만들려다 "JPA metamodel must not be empty"로 실패한다. 별도 @Configuration으로 분리하면
// @WebMvcTest의 컴포넌트 스캔 제외 대상이 되어 문제가 없다.
@Configuration
@EnableJpaAuditing
public class JpaAuditingConfig {
}
