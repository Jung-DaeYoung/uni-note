package com.uninote.backend.dto;

import lombok.Builder;
import lombok.Data;

// (강의, 개념 태그) 단위 풀이 통계(P2-3). 강의가 없는 퀴즈의 문제는 courseId·courseName이 null이다.
@Data
@Builder
public class ConceptStatResponse {
    private String conceptTag;
    private Long courseId;
    private String courseName;
    private long questionCount;
    private long attemptCount;
    private long correctCount;
    private long incorrectCount;
    private double accuracyRate;
    private ReviewPriority reviewPriority;
}
