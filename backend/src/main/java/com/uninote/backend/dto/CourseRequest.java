package com.uninote.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

// 직접 생성 강의의 생성·이름 변경 요청. 강의코드·교수는 받지 않는다.
@Data
public class CourseRequest {
    @NotBlank
    @Size(max = 100)
    private String courseName;
}
