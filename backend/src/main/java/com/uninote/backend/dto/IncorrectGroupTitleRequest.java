package com.uninote.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

// 오답노트 이름 변경 요청. IncorrectNoteGroup.title은 길이 지정 없는 기본 VARCHAR(255)이므로 그보다 긴 입력은 400으로 막는다.
@Data
public class IncorrectGroupTitleRequest {
    @NotBlank
    @Size(max = 255)
    private String title;
}
