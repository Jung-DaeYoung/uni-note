package com.uninote.backend.repository;

import com.uninote.backend.domain.SharedQuizLike;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface SharedQuizLikeRepository extends JpaRepository<SharedQuizLike, Long> {
    Optional<SharedQuizLike> findBySharedQuiz_SharedQuizIdAndStudent_StudId(Long sharedQuizId, Long studId);

    long countBySharedQuiz_SharedQuizId(Long sharedQuizId);

    // 목록에서 내가 추천한 글 표시용.
    @Query("SELECT l.sharedQuiz.sharedQuizId FROM SharedQuizLike l " +
            "WHERE l.student.studId = :studId AND l.sharedQuiz.sharedQuizId IN :sharedQuizIds")
    Set<Long> findLikedSharedQuizIds(@Param("studId") Long studId, @Param("sharedQuizIds") List<Long> sharedQuizIds);
}
