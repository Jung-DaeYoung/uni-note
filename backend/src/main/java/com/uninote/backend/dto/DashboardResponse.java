package com.uninote.backend.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class DashboardResponse {
    private String studentName;
    private List<CourseResponse> courses;
    private List<PostResponse> recentPosts;
    private List<NoteSummaryResponse> recentNotes; // 최근 노트 기록 추가
}
