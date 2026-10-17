package com.uninote.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uninote.backend.exception.ExternalServiceException;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

// Gemini 구조화(JSON) 응답 호출. 프롬프트·스키마·결과 해석은 호출하는 서비스가 맡는다.
@Slf4j
@Component
@RequiredArgsConstructor
public class GeminiClient {
    public static final String MODEL_NAME = "gemini-2.5-flash";

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    private final String GEMINI_API_KEY = System.getenv("GEMINI_API_KEY");
    private final String API_URL = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL_NAME
            + ":generateContent?key=" + GEMINI_API_KEY;

    @PostConstruct
    public void validateConfig() {
        if (GEMINI_API_KEY == null || GEMINI_API_KEY.isBlank()) {
            throw new IllegalStateException("GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.");
        }
    }

    // parts와 responseSchema로 호출하고, 생성된 JSON 텍스트만 반환한다.
    // 호출 실패는 connectFailureMessage로 EXTERNAL_SERVICE_ERROR, 응답 구조 오류는 AI_RESPONSE_INVALID다.
    public String generateJson(List<Map<String, Object>> parts, Map<String, Object> schema, String connectFailureMessage) {
        Map<String, Object> requestBody = Map.of(
            "contents", List.of(Map.of("parts", parts)),
            "generationConfig", Map.of("responseMimeType", "application/json", "responseSchema", schema)
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        String rawResponse;
        try {
            rawResponse = restTemplate.postForObject(API_URL, entity, String.class);
        } catch (RestClientException e) {
            log.error("Gemini API 호출 실패", e);
            throw new ExternalServiceException(connectFailureMessage);
        }
        return extractGeneratedText(rawResponse);
    }

    // AI가 예상한 구조로 응답했는지 확인한 뒤 실제 생성된 텍스트만 꺼낸다.
    // candidates가 비어 있거나(안전 필터 차단 등) 구조가 다르면 명시적으로 실패시킨다.
    private String extractGeneratedText(String rawResponse) {
        JsonNode root;
        try {
            root = objectMapper.readTree(rawResponse);
        } catch (Exception e) {
            throw invalidResponse("AI 응답을 해석할 수 없습니다.");
        }

        JsonNode candidates = root.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            throw invalidResponse("AI가 응답을 생성하지 못했습니다.");
        }

        JsonNode parts = candidates.get(0).path("content").path("parts");
        if (!parts.isArray() || parts.isEmpty()) {
            throw invalidResponse("AI 응답 구조가 올바르지 않습니다.");
        }

        String text = parts.get(0).path("text").asText(null);
        if (text == null || text.isBlank()) {
            throw invalidResponse("AI 응답에 내용이 없습니다.");
        }
        return text;
    }

    private static ExternalServiceException invalidResponse(String message) {
        return new ExternalServiceException(ExternalServiceException.AI_RESPONSE_INVALID, message);
    }
}
