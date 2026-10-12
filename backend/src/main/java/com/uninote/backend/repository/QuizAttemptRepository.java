package com.uninote.backend.repository;

import com.uninote.backend.domain.QuizAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuizAttemptRepository extends JpaRepository<QuizAttempt, Long> {
    // quizSet과 그 course를 fetch join해, 목록 변환 중 풀이 기록마다 세트/강의를
    // lazy loading하는 N+1을 없앤다.
    @Query("SELECT qa FROM QuizAttempt qa " +
            "LEFT JOIN FETCH qa.quizSet qs LEFT JOIN FETCH qs.course " +
            "WHERE qa.student.studId = :studId")
    List<QuizAttempt> findByStudent_StudId(@Param("studId") Long studId);

    @Query("SELECT qa FROM QuizAttempt qa " +
            "LEFT JOIN FETCH qa.quizSet qs LEFT JOIN FETCH qs.course " +
            "WHERE qa.quizSet.quizSetId = :quizSetId AND qa.student.studId = :studId")
    List<QuizAttempt> findByQuizSet_QuizSetIdAndStudent_StudId(@Param("quizSetId") Long quizSetId, @Param("studId") Long studId);
}
