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
    
    // 필드명을 isAuthor로 두면 Jackson이 필드(isAuthor)와 getter(isAuthor() -> author로 인식)를
    // 별개 프로퍼티로 취급해 "author"/"isAuthor"가 중복 직렬화될 수 있다. 필드명은 author로 두고
    // @JsonProperty로만 wire 이름을 isAuthor로 고정한다.
    @com.fasterxml.jackson.annotation.JsonProperty("isAuthor")
    private boolean author; // 본인 작성 여부
    
    private LocalDateTime createdAt;
    private List<CommentResponse> comments;
}
