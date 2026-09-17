package com.uninote.backend.repository;

import com.uninote.backend.domain.QuizSet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuizSetRepository extends JpaRepository<QuizSet, Long> {
    // course를 fetch join해, 목록 변환 중 세트마다 강의를 lazy loading하는 N+1을 없앤다.
    @Query("SELECT qs FROM QuizSet qs LEFT JOIN FETCH qs.course WHERE qs.student.studId = :studId")
    List<QuizSet> findByStudent_StudId(@Param("studId") Long studId);
}
