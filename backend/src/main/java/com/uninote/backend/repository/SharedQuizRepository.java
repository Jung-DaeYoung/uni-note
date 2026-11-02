package com.uninote.backend.repository;

import com.uninote.backend.domain.SharedQuiz;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Set;

public interface SharedQuizRepository extends JpaRepository<SharedQuiz, Long> {
    // 강의를 fetch join해, 목록 변환 중 글마다 강의를 lazy loading하는 N+1을 없앤다.
    @Query("SELECT s FROM SharedQuiz s JOIN FETCH s.course WHERE s.course.courseId IN :courseIds")
    List<SharedQuiz> findByCourseIds(@Param("courseIds") List<Long> courseIds, Sort sort);

    // 통합 검색: 공유된 시험에서 시작하므로 공유되지 않은 퀴즈의 문항은 찾지 않는다.
    @Query("SELECT s FROM SharedQuiz s JOIN FETCH s.course JOIN FETCH s.quizSet qs WHERE s.course.courseId IN :courseIds " +
            "AND (LOWER(qs.title) LIKE CONCAT('%', :pattern, '%') ESCAPE '!' " +
            "OR EXISTS (SELECT 1 FROM Question q WHERE q.quizSet = qs " +
            "AND LOWER(q.questionText) LIKE CONCAT('%', :pattern, '%') ESCAPE '!')) " +
            "ORDER BY s.createdAt DESC, s.sharedQuizId DESC")
    Slice<SharedQuiz> search(@Param("courseIds") List<Long> courseIds, @Param("pattern") String pattern, Pageable pageable);

    boolean existsBySourceQuizSetId(Long sourceQuizSetId);

    boolean existsByQuizSet_QuizSetId(Long quizSetId);

    // 내 퀴즈 목록의 "공유됨" 표시용.
    @Query("SELECT s.sourceQuizSetId FROM SharedQuiz s WHERE s.sourceQuizSetId IN :quizSetIds")
    Set<Long> findSharedSourceQuizSetIds(@Param("quizSetIds") List<Long> quizSetIds);

    // 동시 요청에도 카운터가 어긋나지 않도록 DB에서 원자적으로 증감한다.
    @Modifying
    @Query("UPDATE SharedQuiz s SET s.viewCount = s.viewCount + 1 WHERE s.sharedQuizId = :id")
    void incrementViewCount(@Param("id") Long id);

    @Modifying
    @Query("UPDATE SharedQuiz s SET s.likeCount = s.likeCount + :delta WHERE s.sharedQuizId = :id")
    void addLikeCount(@Param("id") Long id, @Param("delta") int delta);
}
