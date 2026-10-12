package com.uninote.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class CommentRequest {
    @NotBlank
    // Comment 엔티티의 content 컬럼이 길이 지정 없는 기본 VARCHAR(255)이므로, 그보다 긴 입력은
    // DB 저장 시 데이터 손실 오류(500)로 새는 대신 여기서 400으로 미리 막는다.
    @Size(max = 255)
    private String content;
}
