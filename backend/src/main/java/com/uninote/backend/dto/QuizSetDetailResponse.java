package com.uninote.backend.dto;

import com.uninote.backend.domain.QuizDifficulty;
import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class QuizSetDetailResponse {
    private Long quizSetId;
    private String title;
    private QuizDifficulty difficulty;
    private List<QuestionResponse> questions;
}
