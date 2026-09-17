package com.uninote.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class TodayReviewQuestionResponse {
    private QuestionResponse question;
    private Long courseId;
    private String courseName;
    private long attemptCount;
    private long incorrectCount;
    private LocalDateTime lastIncorrectAt;
    private ReviewPriority reviewPriority;
}
