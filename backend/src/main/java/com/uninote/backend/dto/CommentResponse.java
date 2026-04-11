package com.uninote.backend.dto;

import lombok.Builder;
import lombok.Getter;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class CommentResponse {
    private Long commentId;
    private String content;
    private String authorName; // 마스킹된 이름
    private LocalDateTime createdAt;
}
