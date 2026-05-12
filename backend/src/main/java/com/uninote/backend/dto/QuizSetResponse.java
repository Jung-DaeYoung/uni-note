package com.uninote.backend.dto;

import com.uninote.backend.domain.QuizDifficulty;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class QuizSetResponse {
    private Long quizSetId;
    private String title;
    private String courseName;
    private QuizDifficulty difficulty;
    private LocalDateTime createdAt;
    private Integer lastScore; // 마지막 풀이 점수 (선택)
}
