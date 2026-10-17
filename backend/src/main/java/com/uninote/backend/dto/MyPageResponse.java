package com.uninote.backend.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

// GET /api/mypage 응답. summary는 전체 누적, heatmap은 semester 범위 안에서 활동이 있는 날만 담는다.
// courseProgress·recentActivities·myContents는 학기와 관계없이 전체 기간 기준이다.
public record MyPageResponse(Profile profile, Semester semester, Summary summary, List<HeatmapDay> heatmap,
                             List<CourseProgress> courseProgress, List<Activity> recentActivities,
                             MyContents myContents) {

    public record Profile(String name, String studentNum) {}

    public record Semester(String label, LocalDate startDate, LocalDate endDate) {}

    public record Summary(long noteCount, long quizSetCount, long attemptCount, long incorrectNoteCount,
                          long postCount, long commentCount, long sharedCount) {}

    public record HeatmapDay(LocalDate date, long count) {}

    // 활동이 없는 강의도 0으로 담는다. lastActivityAt은 노트 수정·퀴즈 생성·풀이 중 가장 최근 시각이다.
    public record CourseProgress(Long courseId, String courseName, long noteCount, long quizSetCount,
                                 long attemptCount, LocalDateTime lastActivityAt) {}

    // targetId는 type별 원천 ID다(노트 noteId, 게시글·댓글 postId, 공유 노트·댓글 sharedNotePostId 등).
    public record Activity(String type, String title, LocalDateTime occurredAt, Long courseId, Long targetId) {}

    public record MyContents(List<RecentNote> recentNotes, List<SharedNote> sharedNotes,
                             List<SharedQuizItem> sharedQuizzes) {}

    public record RecentNote(Long noteId, Long courseId, String title, LocalDateTime updatedAt) {}

    public record SharedNote(Long postId, String title, LocalDateTime createdAt) {}

    public record SharedQuizItem(Long sharedQuizId, String title, LocalDateTime createdAt) {}
}
