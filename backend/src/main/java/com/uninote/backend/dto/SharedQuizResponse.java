package com.uninote.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.uninote.backend.domain.QuizDifficulty;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class SharedQuizResponse {
    private Long sharedQuizId;
    private Long quizSetId; // 공유된 스냅샷 QuizSet ID(풀이 저장 시 사용)
    private Long courseId;
    private String courseName;
    private String title;
    private QuizDifficulty difficulty;
    private int questionCount;
    private String authorName;

    // PostResponse와 같은 이유로 필드명은 author, wire 이름은 isAuthor로 고정한다.
    @JsonProperty("isAuthor")
    private boolean author;

    private int likeCount;
    private int viewCount;
    private boolean liked; // 내가 추천했는지
    private LocalDateTime createdAt;
}
