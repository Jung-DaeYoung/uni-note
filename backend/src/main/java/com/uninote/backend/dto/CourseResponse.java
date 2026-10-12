package com.uninote.backend.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CourseResponse {
    private Long courseId;
    private String courseName;
    private String courseCode;
    private String professorName; // 직접 생성 강의는 null
    private boolean userCreated;  // 직접 생성 강의 여부(표시용, 권한 판단은 서버가 한다)
}
