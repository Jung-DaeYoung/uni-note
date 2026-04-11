package com.uninote.backend.repository;

import com.uninote.backend.domain.Course;
import com.uninote.backend.domain.Post;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PostRepository extends JpaRepository<Post, Long> {
    List<Post> findByCourseOrderByCreatedAtDesc(Course course);
    List<Post> findTop5ByOrderByCreatedAtDesc(); // 최신글 5개 조회
}
