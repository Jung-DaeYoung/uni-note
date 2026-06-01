package com.uninote.backend.repository;

import com.uninote.backend.domain.Course;
import com.uninote.backend.domain.Note;
import com.uninote.backend.domain.Student;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NoteRepository extends JpaRepository<Note, Long> {
    Optional<Note> findByCourseAndStudent(Course course, Student student);
    List<Note> findByCourseAndParentNoteIsNullOrderByCreatedAtAsc(Course course);
    List<Note> findTop6ByStudentOrderByUpdatedAtDesc(Student student); // 최근 수정된 노트 6개 조회
}
