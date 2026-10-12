package com.uninote.backend.repository;

import com.uninote.backend.domain.Course;
import com.uninote.backend.domain.Post;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

// 게시글(Post) 엔티티를 관리하는 저장소 인터페이스
public interface PostRepository extends JpaRepository<Post, Long> {
    // 특정 강의에 속한 모든 게시글을 생성 시간 기준 내림차순(최신순)으로 조회.
    // 게시글 작성자·댓글·댓글 작성자를 fetch join으로 함께 가져와, 응답 변환 중
    // lazy loading으로 게시글/댓글 수만큼 추가 쿼리가 발생하는 N+1을 없앤다.
    @Query("SELECT DISTINCT p FROM Post p " +
            "LEFT JOIN FETCH p.student " +
            "LEFT JOIN FETCH p.comments c " +
            "LEFT JOIN FETCH c.student " +
            "WHERE p.course = :course " +
            "ORDER BY p.createdAt DESC")
    List<Post> findByCourseOrderByCreatedAtDesc(@Param("course") Course course);

    // 주어진 강의 목록(수강 중인 강의)에 속한 게시글 중 최신순으로 5개 조회
    List<Post> findTop5ByCourseInOrderByCreatedAtDesc(List<Course> courses);
}
