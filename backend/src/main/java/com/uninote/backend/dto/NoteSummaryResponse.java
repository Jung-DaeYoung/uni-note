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
public class NoteSummaryResponse {
    private Long noteId;
    private Long courseId; // 추가
    private String title;
    private String courseName;
    private LocalDateTime updatedAt;
}
