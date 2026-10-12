package com.uninote.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

// 노트 공유 게시판 상세. notes는 공유 시점 스냅샷 트리(루트 하나)다.
@Data
@Builder
public class SharedNoteDetailResponse {
    private Long sharedNotePostId;
    private Long courseId;
    private String courseName;
    private String title;
    private String authorName;

    @JsonProperty("isAuthor")
    private boolean author;

    private LocalDateTime createdAt;
    private List<Node> notes;

    // noteId는 원본 노트 ID로, 본문 PageLink의 noteId와 맞추는 용도로만 쓴다(원본 API 접근은 403).
    @Data
    @Builder
    public static class Node {
        private Long noteId;
        private String title;
        private String content;
        private List<Node> children;
    }
}
