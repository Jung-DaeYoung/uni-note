package com.uninote.backend.dto;

import java.time.LocalDateTime;

// 통합 검색 결과 한 건. targetId는 type별 원본 ID(noteId·postId·sharedNotePostId·sharedQuizId)다.
// blockId·preview·authorName은 null일 수 있다.
public record SearchResultResponse(
        Type type,
        Long targetId,
        String blockId,
        String title,
        String preview,
        Long courseId,
        String courseName,
        String authorName,
        LocalDateTime date) {

    public enum Type { NOTE, COURSE_POST, SHARED_NOTE, SHARED_QUIZ }
}
