package com.uninote.backend.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AddToIncorrectRequest {
    // groupId/newGroupTitle의 상호 배타 검증은 IncorrectNoteService.addToGroup()에서 이미 처리한다.
    private Long groupId;          // 기존 그룹 선택 시
    private String newGroupTitle;  // 새 그룹 생성 시
    @NotNull
    private Long questionId;       // 담을 문항 ID
}
