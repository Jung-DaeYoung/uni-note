package com.uninote.backend.repository;

import com.uninote.backend.domain.UserAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserAnswerRepository extends JpaRepository<UserAnswer, Long> {

    // 퀴즈 삭제 시 해당 퀴즈의 문제를 참조하는 답안을 먼저 지워 FK 제약 위반을 막는다.
    // 오답노트/오늘의 복습 등 가상 세션(quizAttempt.quizSet == null)의 답안도 question_id로
    // 원본 문제를 참조하므로 QuizSet.attempts cascade만으로는 정리되지 않는다.
    void deleteByQuestion_QuizSet_QuizSetId(Long quizSetId);

    // 공유 퀴즈 글이 삭제된 뒤에도, 이미 풀어 본 문제는 오늘의 복습·재풀이를 계속 저장할 수 있게 한다.
    boolean existsByQuizAttempt_Student_StudIdAndQuestion_QuestionId(Long studId, Long questionId);

    // 학생 한 명의 모든 풀이 답안을 문제 단위로 집계한다. quizAttempt.student로 스코핑하므로
    // 가상 세션(quizSet=null, 오답노트 재풀이/오늘의 복습) 기록도 항상 포함된다.
    // qs.course는 없을 수 있으므로 LEFT JOIN으로 명시한다(암묵적 경로 접근은 inner join이 되어
    // 강의가 없는 문제가 결과에서 통째로 누락된다).
    @Query("SELECT q.questionId AS questionId, " +
           "c.courseId AS courseId, c.courseName AS courseName, " +
           "COUNT(ua) AS attemptCount, " +
           "SUM(CASE WHEN ua.isCorrect = true THEN 1L ELSE 0L END) AS correctCount, " +
           "SUM(CASE WHEN ua.isCorrect = false THEN 1L ELSE 0L END) AS incorrectCount, " +
           "MAX(ua.quizAttempt.startTime) AS lastAttemptedAt, " +
           "MAX(CASE WHEN ua.isCorrect = false THEN ua.quizAttempt.startTime ELSE NULL END) AS lastIncorrectAt " +
           "FROM UserAnswer ua JOIN ua.question q JOIN q.quizSet qs LEFT JOIN qs.course c " +
           "WHERE ua.quizAttempt.student.studId = :studId " +
           "GROUP BY q.questionId, c.courseId, c.courseName")
    List<QuestionAnswerStat> aggregateByQuestionForStudent(@Param("studId") Long studId);

    // 간격 반복 복습용. 학생의 문제별 정답 여부를 풀이 시각 순서로 가져와 "마지막 오답 이후 연속 정답 수"를 센다.
    @Query("SELECT ua.question.questionId AS questionId, ua.isCorrect AS isCorrect " +
           "FROM UserAnswer ua WHERE ua.quizAttempt.student.studId = :studId " +
           "ORDER BY ua.quizAttempt.startTime, ua.userAnswerId")
    List<AnswerHistory> findAnswerHistoryForStudent(@Param("studId") Long studId);

    interface AnswerHistory {
        Long getQuestionId();
        Boolean getIsCorrect();
    }
}
