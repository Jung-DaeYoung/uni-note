package com.uninote.backend.repository;

import com.uninote.backend.domain.SharedNoteComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SharedNoteCommentRepository extends JpaRepository<SharedNoteComment, Long> {
    // 작성자를 fetch join해, 응답 변환 중 댓글마다 lazy loading하는 N+1을 없앤다.
    @Query("SELECT c FROM SharedNoteComment c JOIN FETCH c.student " +
            "WHERE c.sharedNotePost.sharedNotePostId = :postId ORDER BY c.createdAt ASC, c.commentId ASC")
    List<SharedNoteComment> findByPostId(@Param("postId") Long postId);
}
