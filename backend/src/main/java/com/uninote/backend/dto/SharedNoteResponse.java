package com.uninote.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

// 노트 공유 게시판 목록 항목.
@Data
@Builder
public class SharedNoteResponse {
    private Long sharedNotePostId;
    private Long courseId;
    private String courseName;
    private String title;
    private String authorName;

    // PostResponse와 같은 이유로 필드명은 author, wire 이름은 isAuthor로 고정한다.
    @JsonProperty("isAuthor")
    private boolean author;

    private LocalDateTime createdAt;
}
