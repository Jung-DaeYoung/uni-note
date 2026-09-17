package com.uninote.backend.repository;

import com.uninote.backend.domain.Question;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuestionRepository extends JpaRepository<Question, Long> {
    // 풀이 기록 목록에서 세트별 문제 "개수"만 필요한 경우, 세트마다 전체 문제 컬렉션을
    // lazy loading하는 N+1 대신 한 번의 GROUP BY로 배치 조회한다.
    @Query("SELECT q.quizSet.quizSetId AS quizSetId, COUNT(q) AS count " +
            "FROM Question q WHERE q.quizSet.quizSetId IN :quizSetIds " +
            "GROUP BY q.quizSet.quizSetId")
    List<QuizSetQuestionCount> countByQuizSetIdIn(@Param("quizSetIds") List<Long> quizSetIds);
}
