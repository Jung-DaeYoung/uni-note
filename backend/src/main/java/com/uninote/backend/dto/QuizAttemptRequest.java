package com.uninote.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.List;

@Data
public class QuizAttemptRequest {
    @NotNull
    private Long quizSetId;
    @NotEmpty
    @Valid
    private List<UserAnswerRequest> userAnswers;

    @Data
    public static class UserAnswerRequest {
        @NotNull
        private Long questionId;
        // 미응답(스킵)한 문제는 null로 제출될 수 있다 (QuizService.isAnswerCorrect가 null을 정상 처리함).
        private String submittedAnswer;
    }
}
