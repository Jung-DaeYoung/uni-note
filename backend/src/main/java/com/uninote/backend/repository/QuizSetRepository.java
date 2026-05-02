package com.uninote.backend.repository;

import com.uninote.backend.domain.QuizSet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuizSetRepository extends JpaRepository<QuizSet, Long> {
    List<QuizSet> findByStudent_StudId(Long studId);
    List<QuizSet> findByCourse_CourseIdAndStudent_StudId(Long courseId, Long studId);
}
