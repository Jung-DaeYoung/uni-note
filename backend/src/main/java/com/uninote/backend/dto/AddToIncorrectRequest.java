package com.uninote.backend.dto;

import lombok.Data;

@Data
public class AddToIncorrectRequest {
    private Long groupId;          // 기존 그룹 선택 시
    private String newGroupTitle;  // 새 그룹 생성 시
    private Long questionId;       // 담을 문항 ID
}
