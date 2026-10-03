package com.uninote.backend.dto;

import lombok.Builder;
import lombok.Data;

// 문제 출처 블록(noteId/blockId) 단위 풀이 통계. 취약 블록으로 문제 범위를 고를 때 쓴다.
@Data
@Builder
public class SourceBlockStatResponse {
    private Long noteId;
    private String blockId;
    private long attemptCount;
    private long correctCount;
    private long incorrectCount;
    private double accuracyRate;
    private ReviewPriority reviewPriority;
}
