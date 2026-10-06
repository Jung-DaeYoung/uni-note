package com.uninote.backend.repository;

import com.uninote.backend.domain.SharedQuizComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SharedQuizCommentRepository extends JpaRepository<SharedQuizComment, Long> {
    // 작성자와 문제를 fetch join해, 응답 변환 중 댓글마다 lazy loading하는 N+1을 없앤다.
    @Query("SELECT c FROM SharedQuizComment c JOIN FETCH c.student JOIN FETCH c.question " +
            "WHERE c.sharedQuiz.sharedQuizId = :sharedQuizId ORDER BY c.createdAt ASC, c.commentId ASC")
    List<SharedQuizComment> findBySharedQuizId(@Param("sharedQuizId") Long sharedQuizId);
}
