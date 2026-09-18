package com.uninote.backend.dto;

import com.uninote.backend.domain.QuestionType;
import com.uninote.backend.domain.QuizDifficulty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class QuizRequest {
    @NotEmpty
    private List<@Positive Long> noteIds;
    @NotEmpty
    private Map<QuestionType, @Min(0) @Max(50) Integer> typeCounts;
    @NotNull
    private QuizDifficulty difficulty;
}
