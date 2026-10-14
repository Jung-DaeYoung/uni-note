package com.uninote.backend.repository;

import com.uninote.backend.domain.Student;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

// 마이페이지 전용 조회. 여러 엔티티에 걸친 "학생 한 명의 활동"을 한 곳에 모은다.
// 히트맵은 엔티티를 불러오지 않고 날짜 컬럼만 조회해 서비스에서 날짜별로 합친다. 기간은 [from, to).
public interface MyPageActivityRepository extends Repository<Student, Long> {

    // 노트는 생성일과 마지막 수정일을 함께 본다. 둘 중 하나라도 기간 안이면 포함한다. [createdAt, updatedAt]
    @Query("SELECT n.createdAt, n.updatedAt FROM Note n WHERE n.student = :student " +
           "AND ((n.createdAt >= :from AND n.createdAt < :to) OR (n.updatedAt >= :from AND n.updatedAt < :to))")
    List<Object[]> findNoteTimes(@Param("student") Student student, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("SELECT p.createdAt FROM Post p WHERE p.student = :student AND p.createdAt >= :from AND p.createdAt < :to")
    List<LocalDateTime> findPostTimes(@Param("student") Student student, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("SELECT c.createdAt FROM Comment c WHERE c.student = :student AND c.createdAt >= :from AND c.createdAt < :to")
    List<LocalDateTime> findCommentTimes(@Param("student") Student student, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("SELECT c.createdAt FROM SharedNoteComment c WHERE c.student = :student AND c.createdAt >= :from AND c.createdAt < :to")
    List<LocalDateTime> findSharedNoteCommentTimes(@Param("student") Student student, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("SELECT c.createdAt FROM SharedQuizComment c WHERE c.student = :student AND c.createdAt >= :from AND c.createdAt < :to")
    List<LocalDateTime> findSharedQuizCommentTimes(@Param("student") Student student, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("SELECT q.createdAt FROM QuizSet q WHERE q.student = :student AND q.createdAt >= :from AND q.createdAt < :to")
    List<LocalDateTime> findQuizSetTimes(@Param("student") Student student, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    // 복습 재풀이도 QuizAttempt로 저장되므로 여기에 포함된다.
    @Query("SELECT a.startTime FROM QuizAttempt a WHERE a.student = :student AND a.startTime >= :from AND a.startTime < :to")
    List<LocalDateTime> findAttemptTimes(@Param("student") Student student, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("SELECT i.addedAt FROM IncorrectNoteItem i WHERE i.group.student = :student AND i.addedAt >= :from AND i.addedAt < :to")
    List<LocalDateTime> findIncorrectItemTimes(@Param("student") Student student, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("SELECT s.createdAt FROM SharedNotePost s WHERE s.student = :student AND s.createdAt >= :from AND s.createdAt < :to")
    List<LocalDateTime> findSharedNoteTimes(@Param("student") Student student, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("SELECT s.createdAt FROM SharedQuiz s WHERE s.student = :student AND s.createdAt >= :from AND s.createdAt < :to")
    List<LocalDateTime> findSharedQuizTimes(@Param("student") Student student, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    // 통계 카드용 전체 누적 개수
    @Query("SELECT COUNT(n) FROM Note n WHERE n.student = :student")
    long countNotes(@Param("student") Student student);

    @Query("SELECT COUNT(q) FROM QuizSet q WHERE q.student = :student")
    long countQuizSets(@Param("student") Student student);

    @Query("SELECT COUNT(a) FROM QuizAttempt a WHERE a.student = :student")
    long countAttempts(@Param("student") Student student);

    @Query("SELECT COUNT(i) FROM IncorrectNoteItem i WHERE i.group.student = :student")
    long countIncorrectItems(@Param("student") Student student);

    @Query("SELECT COUNT(p) FROM Post p WHERE p.student = :student")
    long countPosts(@Param("student") Student student);

    @Query("SELECT COUNT(c) FROM Comment c WHERE c.student = :student")
    long countComments(@Param("student") Student student);

    @Query("SELECT COUNT(c) FROM SharedNoteComment c WHERE c.student = :student")
    long countSharedNoteComments(@Param("student") Student student);

    @Query("SELECT COUNT(c) FROM SharedQuizComment c WHERE c.student = :student")
    long countSharedQuizComments(@Param("student") Student student);

    @Query("SELECT COUNT(s) FROM SharedNotePost s WHERE s.student = :student")
    long countSharedNotes(@Param("student") Student student);

    @Query("SELECT COUNT(s) FROM SharedQuiz s WHERE s.student = :student")
    long countSharedQuizzes(@Param("student") Student student);
}
