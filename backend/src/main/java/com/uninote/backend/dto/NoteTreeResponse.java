package com.uninote.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NoteTreeResponse {
    private Long noteId;
    private String title;
    private List<NoteTreeResponse> children;
}
