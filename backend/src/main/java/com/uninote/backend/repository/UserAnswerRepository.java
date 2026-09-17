package com.uninote.backend.repository;

import com.uninote.backend.domain.UserAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserAnswerRepository extends JpaRepository<UserAnswer, Long> {
    List<UserAnswer> findByQuizAttempt_AttemptId(Long attemptId);

    // 학생 한 명의 모든 풀이 답안을 문제 단위로 집계한다. quizAttempt.student로 스코핑하므로
    // 가상 세션(quizSet=null, 오답노트 재풀이/오늘의 복습) 기록도 항상 포함된다.
    // qs.course는 없을 수 있으므로 LEFT JOIN으로 명시한다(암묵적 경로 접근은 inner join이 되어
    // 강의가 없는 문제가 결과에서 통째로 누락된다).
    @Query("SELECT q.questionId AS questionId, " +
           "c.courseId AS courseId, c.courseName AS courseName, q.type AS type, " +
           "COUNT(ua) AS attemptCount, " +
           "SUM(CASE WHEN ua.isCorrect = true THEN 1L ELSE 0L END) AS correctCount, " +
           "SUM(CASE WHEN ua.isCorrect = false THEN 1L ELSE 0L END) AS incorrectCount, " +
           "MAX(ua.quizAttempt.startTime) AS lastAttemptedAt, " +
           "MAX(CASE WHEN ua.isCorrect = false THEN ua.quizAttempt.startTime ELSE NULL END) AS lastIncorrectAt " +
           "FROM UserAnswer ua JOIN ua.question q JOIN q.quizSet qs LEFT JOIN qs.course c " +
           "WHERE ua.quizAttempt.student.studId = :studId " +
           "GROUP BY q.questionId, c.courseId, c.courseName, q.type")
    List<QuestionAnswerStat> aggregateByQuestionForStudent(@Param("studId") Long studId);
}
