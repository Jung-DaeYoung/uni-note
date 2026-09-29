package com.uninote.backend.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;

// AI 퀴즈 생성에 쓸 노트 추출 결과. 재생성 시 노트 파싱·미디어 파일 읽기를 반복하지 않도록
// 한 번 만든 뒤 재사용한다. allowedSources는 추출 중 실제로 [[REF:noteId/blockId]]를 붙인
// 출처 쌍이며, AI가 반환한 출처가 이 집합에 없으면 미검증으로 처리한다(QuizQualityValidator).
public record QuizGenerationInput(
        String text,
        List<Map<String, Object>> mediaParts,
        Map<Long, Set<String>> allowedSources
) {
    public boolean isEmpty() {
        return text.isBlank() && mediaParts.isEmpty();
    }

    // AI에 실제로 전달한 원문(텍스트 + 미디어 base64 데이터)의 SHA-256. 생성 결과 로그에서
    // 같은 원문으로 만든 요청을 식별하는 데 쓴다.
    public String contentHash() {
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            // SHA-256은 모든 JDK 구현에 포함되어야 하는 필수 알고리즘이다.
            throw new IllegalStateException(e);
        }
        digest.update(text.getBytes(StandardCharsets.UTF_8));
        for (Map<String, Object> part : mediaParts) {
            if (part.get("inline_data") instanceof Map<?, ?> inlineData
                    && inlineData.get("data") instanceof String data) {
                digest.update((byte) 0); // 텍스트·미디어 경계를 구분해 서로 다른 입력이 같은 바이트열이 되지 않게 한다.
                digest.update(data.getBytes(StandardCharsets.UTF_8));
            }
        }
        return HexFormat.of().formatHex(digest.digest());
    }
}
