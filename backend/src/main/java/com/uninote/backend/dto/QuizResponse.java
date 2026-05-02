package com.uninote.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.uninote.backend.domain.QuizDifficulty;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class QuizResponse {
    @JsonProperty("title")
    private String title;
    
    @JsonProperty("difficulty")
    private QuizDifficulty difficulty;
    
    @JsonProperty("questions")
    @com.fasterxml.jackson.annotation.JsonAlias({"question", "data"})
    private List<QuestionResponse> questions = new ArrayList<>();
}
