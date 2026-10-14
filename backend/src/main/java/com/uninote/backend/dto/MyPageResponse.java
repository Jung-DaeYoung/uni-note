package com.uninote.backend.dto;

import java.time.LocalDate;
import java.util.List;

// GET /api/mypage 응답. summary는 전체 누적, heatmap은 semester 범위 안에서 활동이 있는 날만 담는다.
public record MyPageResponse(Profile profile, Semester semester, Summary summary, List<HeatmapDay> heatmap) {

    public record Profile(String name, String studentNum) {}

    public record Semester(String label, LocalDate startDate, LocalDate endDate) {}

    public record Summary(long noteCount, long quizSetCount, long attemptCount, long incorrectNoteCount,
                          long postCount, long commentCount, long sharedCount) {}

    public record HeatmapDay(LocalDate date, long count) {}
}
