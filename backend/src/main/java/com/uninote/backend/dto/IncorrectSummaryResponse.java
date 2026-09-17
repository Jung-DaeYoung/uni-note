package com.uninote.backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class IncorrectSummaryResponse {
    private long totalAttemptCount;
    private long totalQuestionCount;
    private long correctCount;
    private long incorrectCount;
    private double accuracyRate;
    private long reviewTargetCount;
    private long repeatIncorrectCount;
}
