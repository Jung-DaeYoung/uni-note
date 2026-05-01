package com.uninote.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NoteRequest {
    private String title;
    private String content;
    private String previewText;
    private String searchContent;
}
