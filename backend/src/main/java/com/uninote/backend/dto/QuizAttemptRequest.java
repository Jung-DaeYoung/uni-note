package com.uninote.backend.dto;

import lombok.Data;
import java.util.List;

@Data
public class QuizAttemptRequest {
    private Long quizSetId;
    private Integer score;
    private List<UserAnswerRequest> userAnswers;

    @Data
    public static class UserAnswerRequest {
        private Long questionId;
        private String submittedAnswer;
        private Boolean isCorrect;
    }
}
