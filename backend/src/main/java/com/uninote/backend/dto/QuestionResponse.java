package com.uninote.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.uninote.backend.domain.QuestionType;
import lombok.Data;
import java.util.List;

@Data
public class QuestionResponse {
    @JsonProperty("type")
    private QuestionType type;
    
    @JsonProperty("questionText")
    private String questionText;
    
    @JsonProperty("imagePath")
    private String imagePath;
    
    @JsonProperty("options")
    private List<String> options;
    
    @JsonProperty("correctAnswer")
    private String correctAnswer;
    
    @JsonProperty("explanation")
    private String explanation;
    
    @JsonProperty("sourceNoteId")
    private Long sourceNoteId;
    
    @JsonProperty("sourceBlockId")
    private String sourceBlockId;
}
