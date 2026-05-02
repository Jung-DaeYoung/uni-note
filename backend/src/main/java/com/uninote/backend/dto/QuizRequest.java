package com.uninote.backend.dto;

import com.uninote.backend.domain.QuestionType;
import com.uninote.backend.domain.QuizDifficulty;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class QuizRequest {
    private List<Long> noteIds;
    private Map<QuestionType, Integer> typeCounts;
    private QuizDifficulty difficulty;
}
