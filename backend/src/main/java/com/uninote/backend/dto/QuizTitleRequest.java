package com.uninote.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

// 퀴즈 이름 변경 요청. QuizSet.title은 길이 지정 없는 기본 VARCHAR(255)이므로 그보다 긴 입력은 400으로 막는다.
@Data
public class QuizTitleRequest {
    @NotBlank
    @Size(max = 255)
    private String title;
}
