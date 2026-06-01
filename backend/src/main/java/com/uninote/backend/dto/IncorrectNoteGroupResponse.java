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
public class IncorrectNoteGroupResponse {
    private Long id;
    private String title;
    private int itemCount;
    private LocalDateTime createdAt;
}
