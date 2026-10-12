package com.uninote.backend.dto;

import com.uninote.backend.domain.QuestionType;
import lombok.Data;
import java.util.List;

@Data
public class QuestionResponse {
    private Long questionId;
    private QuestionType type;
    private String questionText;
    
    private List<String> options;
    private String correctAnswer;
    private String explanation;
    private Long sourceNoteId;
    private String sourceBlockId;
}
