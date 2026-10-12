package com.uninote.backend.dto;

import com.uninote.backend.domain.QuestionType;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class QuestionTypeIncorrectStatResponse {
    private QuestionType type;
    private long attemptCount;
    private long correctCount;
    private long incorrectCount;
    private double accuracyRate;
}
