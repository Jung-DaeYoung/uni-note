package com.uninote.backend.dto;

import java.util.List;

public record KeywordExplainResponse(
        String keyword,
        String summary,
        String easyExplanation,
        String advancedExplanation,
        List<String> relatedKeywords,
        List<Resource> resources
) {
    // url은 서버가 허용 사이트의 검색 URL로만 만든다(KeywordService.ResourceSite).
    public record Resource(String title, String url, String source, String reason) {}
}
