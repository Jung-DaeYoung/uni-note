package com.uninote.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CommentResponse {
    private Long commentId;
    private String content;
    private String authorName; // 마스킹된 이름
    
    @com.fasterxml.jackson.annotation.JsonProperty("isAuthor")
    private boolean isAuthor;  // 본인 작성 여부
    
    private LocalDateTime createdAt;
}
