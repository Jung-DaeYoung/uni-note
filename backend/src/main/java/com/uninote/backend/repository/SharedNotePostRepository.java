package com.uninote.backend.repository;

import com.uninote.backend.domain.SharedNotePost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SharedNotePostRepository extends JpaRepository<SharedNotePost, Long> {
    // 강의·작성자를 fetch join해, 목록 변환 중 글마다 lazy loading하는 N+1을 없앤다.
    @Query("SELECT p FROM SharedNotePost p JOIN FETCH p.course JOIN FETCH p.student " +
            "WHERE p.course.courseId IN :courseIds ORDER BY p.createdAt DESC, p.sharedNotePostId DESC")
    List<SharedNotePost> findByCourseIds(@Param("courseIds") List<Long> courseIds);

    boolean existsBySourceRootNoteId(Long sourceRootNoteId);
}
