package com.uninote.backend.repository;

import com.uninote.backend.domain.Course;
import com.uninote.backend.domain.Note;
import com.uninote.backend.domain.Student;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NoteRepository extends JpaRepository<Note, Long> {
    // 노트 트리 전체를 한 번에 조회해 자식 노트를 재귀적으로 lazy loading하는 N+1을 없앤다.
    // 트리 구성은 서비스 계층에서 parentNoteId 기준으로 메모리에서 그룹핑한다.
    List<Note> findByCourseAndStudentOrderByCreatedAtAsc(Course course, Student student);
    List<Note> findTop6ByStudentOrderByUpdatedAtDesc(Student student); // 최근 수정된 노트 6개 조회
}
