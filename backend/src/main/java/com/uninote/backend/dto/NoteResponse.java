package com.uninote.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NoteResponse {
    private Long noteId;
    private Long courseId;
    private String goals;
    private String content;
    private String questions;
    private String aiSummary;
    private String aiQuizData;
    private LocalDateTime updatedAt;
}
