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
    // 유형당 1~20개. QuizService.MAX_QUESTIONS_PER_TYPE, QuizConfigModal의 상한과 같게 유지한다.
    @NotEmpty
    private Map<QuestionType, @Min(1) @Max(20) Integer> typeCounts;
    @NotNull
    private QuizDifficulty difficulty;
}
