package com.uninote.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class IncorrectNoteGroupResponse {
    private Long id;
    private String title;
    private int itemCount;
    private LocalDateTime createdAt;
}
