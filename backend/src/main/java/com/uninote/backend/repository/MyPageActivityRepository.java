package com.uninote.backend.repository;

import com.uninote.backend.domain.Student;
import org.springframework.data.domain.Pageable;
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

    // 강의별 현황: [courseId, 개수, 마지막 활동 시각]
    @Query("SELECT c.courseId, COUNT(n), MAX(n.updatedAt) FROM Note n JOIN n.course c WHERE n.student = :student GROUP BY c.courseId")
    List<Object[]> countNotesByCourse(@Param("student") Student student);

    @Query("SELECT c.courseId, COUNT(q), MAX(q.createdAt) FROM QuizSet q JOIN q.course c WHERE q.student = :student GROUP BY c.courseId")
    List<Object[]> countQuizSetsByCourse(@Param("student") Student student);

    @Query("SELECT c.courseId, COUNT(a), MAX(a.startTime) FROM QuizAttempt a JOIN a.quizSet q JOIN q.course c WHERE a.student = :student GROUP BY c.courseId")
    List<Object[]> countAttemptsByCourse(@Param("student") Student student);

    // 최근 활동: [title, occurredAt, courseId, targetId]. 원천마다 최신 N건만 받아 서비스에서 합친다.
    @Query("SELECT n.title, n.createdAt, c.courseId, n.noteId FROM Note n LEFT JOIN n.course c WHERE n.student = :student ORDER BY n.createdAt DESC")
    List<Object[]> findRecentNoteCreations(@Param("student") Student student, Pageable pageable);

    // 히트맵과 같은 규칙: 마지막 수정일이 생성일과 다른 날일 때만 수정 활동으로 본다.
    @Query("SELECT n.title, n.updatedAt, c.courseId, n.noteId FROM Note n LEFT JOIN n.course c WHERE n.student = :student " +
           "AND CAST(n.updatedAt AS LocalDate) <> CAST(n.createdAt AS LocalDate) ORDER BY n.updatedAt DESC")
    List<Object[]> findRecentNoteUpdates(@Param("student") Student student, Pageable pageable);

    @Query("SELECT p.title, p.createdAt, c.courseId, p.postId FROM Post p LEFT JOIN p.course c WHERE p.student = :student ORDER BY p.createdAt DESC")
    List<Object[]> findRecentPosts(@Param("student") Student student, Pageable pageable);

    @Query("SELECT p.title, cm.createdAt, c.courseId, p.postId FROM Comment cm JOIN cm.post p LEFT JOIN p.course c WHERE cm.student = :student ORDER BY cm.createdAt DESC")
    List<Object[]> findRecentComments(@Param("student") Student student, Pageable pageable);

    @Query("SELECT s.title, cm.createdAt, s.course.courseId, s.sharedNotePostId FROM SharedNoteComment cm JOIN cm.sharedNotePost s WHERE cm.student = :student ORDER BY cm.createdAt DESC")
    List<Object[]> findRecentSharedNoteComments(@Param("student") Student student, Pageable pageable);

    @Query("SELECT s.quizSet.title, cm.createdAt, s.course.courseId, s.sharedQuizId FROM SharedQuizComment cm JOIN cm.sharedQuiz s WHERE cm.student = :student ORDER BY cm.createdAt DESC")
    List<Object[]> findRecentSharedQuizComments(@Param("student") Student student, Pageable pageable);

    @Query("SELECT q.title, q.createdAt, c.courseId, q.quizSetId FROM QuizSet q LEFT JOIN q.course c WHERE q.student = :student ORDER BY q.createdAt DESC")
    List<Object[]> findRecentQuizSets(@Param("student") Student student, Pageable pageable);

    @Query("SELECT q.title, a.startTime, c.courseId, a.attemptId FROM QuizAttempt a JOIN a.quizSet q LEFT JOIN q.course c WHERE a.student = :student ORDER BY a.startTime DESC")
    List<Object[]> findRecentAttempts(@Param("student") Student student, Pageable pageable);

    @Query("SELECT qs.questionText, i.addedAt, c.courseId, i.id FROM IncorrectNoteItem i JOIN i.question qs JOIN qs.quizSet q LEFT JOIN q.course c " +
           "WHERE i.group.student = :student ORDER BY i.addedAt DESC")
    List<Object[]> findRecentIncorrectItems(@Param("student") Student student, Pageable pageable);

    @Query("SELECT s.title, s.createdAt, s.course.courseId, s.sharedNotePostId FROM SharedNotePost s WHERE s.student = :student ORDER BY s.createdAt DESC")
    List<Object[]> findRecentSharedNotes(@Param("student") Student student, Pageable pageable);

    @Query("SELECT s.quizSet.title, s.createdAt, s.course.courseId, s.sharedQuizId FROM SharedQuiz s WHERE s.student = :student ORDER BY s.createdAt DESC")
    List<Object[]> findRecentSharedQuizzes(@Param("student") Student student, Pageable pageable);
}
