package com.uninote.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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
        // user_answers.submitted_answer는 VARCHAR(255)다. 넘으면 DB 오류(409) 대신 400으로 안내한다.
        @Size(max = 255, message = "답안은 255자 이하로 입력해 주세요.")
        private String submittedAnswer;
    }
}
