package com.uninote.backend.dto;

import com.uninote.backend.domain.QuestionType;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class IncorrectQuestionStatResponse {
    private Long questionId;
    private String questionText;
    private Long courseId;
    private String courseName;
    private Long sourceNoteId;
    private String sourceBlockId;
    private QuestionType type;
    private long attemptCount;
    private long correctCount;
    private long incorrectCount;
    private LocalDateTime lastAttemptedAt;
    private LocalDateTime lastIncorrectAt;
    private double accuracyRate;
    private ReviewPriority reviewPriority;
}
