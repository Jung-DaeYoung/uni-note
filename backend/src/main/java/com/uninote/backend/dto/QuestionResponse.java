package com.uninote.backend.dto;

import com.uninote.backend.domain.QuestionType;
import lombok.Data;
import java.util.ArrayList;
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
    // 문항이 평가하는 핵심 개념. 태그 도입 전 문제는 빈 배열이다.
    private List<String> conceptTags = new ArrayList<>();
}
