package com.uninote.backend.repository;

import com.uninote.backend.domain.SharedNotePost;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SharedNotePostRepository extends JpaRepository<SharedNotePost, Long> {
    // 강의·작성자를 fetch join해, 목록 변환 중 글마다 lazy loading하는 N+1을 없앤다.
    @Query("SELECT p FROM SharedNotePost p JOIN FETCH p.course JOIN FETCH p.student " +
            "WHERE p.course.courseId IN :courseIds ORDER BY p.createdAt DESC, p.sharedNotePostId DESC")
    List<SharedNotePost> findByCourseIds(@Param("courseIds") List<Long> courseIds);

    // 통합 검색: 주어진 강의의 공유 노트 중 제목에 검색어가 든 글.
    @Query("SELECT p FROM SharedNotePost p JOIN FETCH p.course WHERE p.course.courseId IN :courseIds " +
            "AND LOWER(p.title) LIKE CONCAT('%', :pattern, '%') ESCAPE '!' " +
            "ORDER BY p.createdAt DESC, p.sharedNotePostId DESC")
    Slice<SharedNotePost> search(@Param("courseIds") List<Long> courseIds, @Param("pattern") String pattern, Pageable pageable);

    boolean existsBySourceRootNoteId(Long sourceRootNoteId);
}
