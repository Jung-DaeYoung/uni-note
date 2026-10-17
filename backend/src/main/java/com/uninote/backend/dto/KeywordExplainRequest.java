package com.uninote.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class KeywordExplainRequest {
    // KeywordSelectionMenu의 MAX_KEYWORD_LENGTH / MAX_CONTEXT_LENGTH와 같게 유지한다.
    @NotBlank
    @Size(max = 80)
    private String keyword;
    // 선택한 블록의 텍스트. 클라이언트가 보낸 값이라 설명 프롬프트에만 쓰고 문제 생성에는 쓰지 않는다.
    @Size(max = 2000)
    private String context;
    @Positive
    private Long courseId;
    // 있으면 본인 노트인지 확인한다.
    @Positive
    private Long noteId;
    @Size(max = 100)
    private String blockId;
}
