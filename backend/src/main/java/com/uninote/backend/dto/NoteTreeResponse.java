package com.uninote.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class NoteTreeResponse {
    private Long noteId;
    private String title;
    private List<NoteTreeResponse> children;
}
