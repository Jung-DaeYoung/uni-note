package com.uninote.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class TodayReviewQuestionResponse {
    private QuestionResponse question;
    private Long courseId;
    private String courseName;
    private long attemptCount;
    private long incorrectCount;
    private LocalDateTime lastIncorrectAt;
    private ReviewPriority reviewPriority;
    private LocalDate nextReviewAt; // 간격 반복 일정상 복습 예정일(오늘 이전이면 밀린 것)
    private int streak;             // 마지막 오답 이후 연속 정답 수
}
