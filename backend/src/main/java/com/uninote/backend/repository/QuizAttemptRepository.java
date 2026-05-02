package com.uninote.backend.repository;

import com.uninote.backend.domain.QuizAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuizAttemptRepository extends JpaRepository<QuizAttempt, Long> {
    List<QuizAttempt> findByStudent_StudId(Long studId);
    List<QuizAttempt> findByQuizSet_QuizSetIdAndStudent_StudId(Long quizSetId, Long studId);
}
