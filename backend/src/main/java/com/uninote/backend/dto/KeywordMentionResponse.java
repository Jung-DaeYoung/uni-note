package com.uninote.backend.dto;

// 키워드가 나온 노트 블록. blockId가 없는 옛 블록은 null이다(노트로만 이동).
public record KeywordMentionResponse(Long noteId, String noteTitle, String blockId, String preview) {}
