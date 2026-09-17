package com.uninote.backend.dto;

import com.uninote.backend.domain.QuestionType;
import com.uninote.backend.domain.QuizDifficulty;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class QuizRequest {
    @NotEmpty
    private List<Long> noteIds;
    @NotEmpty
    private Map<QuestionType, Integer> typeCounts;
    @NotNull
    private QuizDifficulty difficulty;
}
