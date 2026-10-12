package com.uninote.backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CourseIncorrectStatResponse {
    private Long courseId;
    private String courseName;
    private long questionCount;
    private long correctCount;
    private long incorrectCount;
    private double accuracyRate;
    private long reviewTargetCount;
}
