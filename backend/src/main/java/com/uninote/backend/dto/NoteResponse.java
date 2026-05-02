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
public class NoteResponse {
    private Long noteId;
    private Long courseId;
    private Long parentNoteId;
    private String title;
    private String content;
    private LocalDateTime updatedAt;
    private List<NoteSummary> breadcrumbs;

    @Data
    @AllArgsConstructor
    public static class NoteSummary {
        private Long noteId;
        private String title;
    }
}
