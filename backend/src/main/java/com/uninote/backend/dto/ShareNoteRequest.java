package com.uninote.backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class ShareNoteRequest {
    @NotNull
    @Positive
    private Long rootNoteId; // 공유할 본인 노트(하위 노트 포함)
}
