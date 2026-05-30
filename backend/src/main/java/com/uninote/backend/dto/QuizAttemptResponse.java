package com.uninote.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class QuizAttemptResponse {
    private Long attemptId;
    private Long quizSetId;
    private Long courseId;
    private String quizTitle;
    private Integer score;
    private Integer totalQuestions;
    private LocalDateTime createdAt;
}
