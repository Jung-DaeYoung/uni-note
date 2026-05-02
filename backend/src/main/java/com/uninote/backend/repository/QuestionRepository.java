package com.uninote.backend.repository;

import com.uninote.backend.domain.Question;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuestionRepository extends JpaRepository<Question, Long> {
    List<Question> findByQuizSet_QuizSetId(Long quizSetId);
}
