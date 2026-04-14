package com.uninote.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PostResponse {
    private Long postId;
    private Long courseId;
    private String courseName; // 추가: 대시보드 표시용
    private String title;
    private String content;
    private String authorName;
    private boolean isAuthor; // 본인 작성 여부
    private LocalDateTime createdAt;
    private List<CommentResponse> comments;
}
