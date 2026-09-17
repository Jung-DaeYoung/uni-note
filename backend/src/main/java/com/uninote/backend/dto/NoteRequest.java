package com.uninote.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NoteRequest {
    @NotBlank
    @Size(max = 200)
    private String title;
    @NotBlank
    private String content;
    // 빈 노트(제목만 있고 본문이 없는 상태)에서는 정상적으로 빈 문자열이 오므로 @NotBlank를 걸지 않는다.
    private String previewText;
    private String searchContent;
}
