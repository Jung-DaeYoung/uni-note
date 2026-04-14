package com.uninote.backend.repository;

import com.uninote.backend.domain.Course;
import com.uninote.backend.domain.Post;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

// 게시글(Post) 엔티티를 관리하는 저장소 인터페이스
public interface PostRepository extends JpaRepository<Post, Long> {
    // 특정 강의에 속한 모든 게시글을 생성 시간 기준 내림차순(최신순)으로 조회
    List<Post> findByCourseOrderByCreatedAtDesc(Course course);

    // 전체 게시글 중 최신순으로 5개 조회
    List<Post> findTop5ByOrderByCreatedAtDesc();
}
