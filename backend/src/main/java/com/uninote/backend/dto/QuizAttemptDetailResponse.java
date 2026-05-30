package com.uninote.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class QuizAttemptDetailResponse {
    private Long attemptId;
    private Long quizSetId;
    private Long courseId;
    private String quizTitle;
    private String difficulty;
    private Integer score;
    private LocalDateTime createdAt;
    private List<UserAnswerDetailResponse> userAnswers;

    @Data
    @Builder
    public static class UserAnswerDetailResponse {
        private QuestionResponse question;
        private String submittedAnswer;
        private Boolean isCorrect;
    }
}
