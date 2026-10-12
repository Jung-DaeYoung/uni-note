package com.uninote.backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class ShareQuizRequest {
    @NotNull
    @Positive
    private Long quizSetId; // 공유할 본인 원본 퀴즈
}
