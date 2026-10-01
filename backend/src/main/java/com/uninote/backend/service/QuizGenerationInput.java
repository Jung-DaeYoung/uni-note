package com.uninote.backend.service;

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
}
