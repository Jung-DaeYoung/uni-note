package com.uninote.backend.dto;

import java.util.List;

// 결과가 있는 유형만 groups에 담는다.
public record SearchResponse(String query, List<Group> groups) {

    public record Group(SearchResultResponse.Type type, boolean hasMore, List<SearchResultResponse> results) {
    }
}
