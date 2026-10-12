package com.uninote.backend.dto;

import com.uninote.backend.domain.QuizDifficulty;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class QuizSetResponse {
    private Long quizSetId;
    private Long courseId;
    private String title;
    private String courseName;
    private QuizDifficulty difficulty;
    private LocalDateTime createdAt;
    private boolean shared; // CBT 시험 공유게시판에 올렸는지
}
