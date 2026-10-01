package com.uninote.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class NoteSummaryResponse {
    private Long noteId;
    private Long courseId; // 추가
    private String title;
    private String courseName;
    private LocalDateTime updatedAt;
}
