package com.uninote.backend.dto;

import com.uninote.backend.domain.QuizDifficulty;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class QuizResponse {
    private Long quizSetId;
    private String title;
    private QuizDifficulty difficulty;
    @com.fasterxml.jackson.annotation.JsonAlias({"question", "data"})
    private List<QuestionResponse> questions = new ArrayList<>();
}
