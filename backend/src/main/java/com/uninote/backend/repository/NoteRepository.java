package com.uninote.backend.repository;

import com.uninote.backend.domain.Course;
import com.uninote.backend.domain.Note;
import com.uninote.backend.domain.Student;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

// 강의 노트(Note) 엔티티를 관리하는 저장소 인터페이스
public interface NoteRepository extends JpaRepository<Note, Long> {
    // 특정 강의에서 특정 학생이 작성한 노트를 조회
    Optional<Note> findByCourseAndStudent(Course course, Student student);
}
