package com.uninote.backend.repository;

import com.uninote.backend.domain.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

// 댓글(Comment) 엔티티를 관리하는 저장소 인터페이스
// JpaRepository를 상속받아 기본적인 CRUD 기능을 자동으로 제공받음
@Repository
public interface CommentRepository extends JpaRepository<Comment, Long> {
}
