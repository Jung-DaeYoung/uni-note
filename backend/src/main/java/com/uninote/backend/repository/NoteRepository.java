package com.uninote.backend.repository;

import com.uninote.backend.domain.Course;
import com.uninote.backend.domain.Note;
import com.uninote.backend.domain.Student;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface NoteRepository extends JpaRepository<Note, Long> {
    // 노트 트리 전체를 한 번에 조회해 자식 노트를 재귀적으로 lazy loading하는 N+1을 없앤다.
    // 트리 구성은 서비스 계층에서 parentNoteId 기준으로 메모리에서 그룹핑한다.
    List<Note> findByCourseAndStudentOrderByCreatedAtAsc(Course course, Student student);
    List<Note> findTop6ByStudentOrderByUpdatedAtDesc(Student student); // 최근 수정된 노트 6개 조회
    List<Note> findByCourse_CourseIdAndParentNoteIsNull(Long courseId); // 강의 삭제 시 루트 노트(하위는 cascade)

    // 키워드 언급 검색 후보: 학생·강의의 노트 중 검색용 평문에 키워드가 든 노트(최근 수정 순).
    // pattern은 호출하는 쪽이 %·_·!를 '!'로 이스케이프하고 소문자로 넘긴다(MySQL은 '\' 리터럴을 이스케이프 시작으로 읽는다).
    @Query("SELECT n FROM Note n WHERE n.student.studId = :studId AND n.course.courseId = :courseId " +
            "AND LOWER(n.searchContent) LIKE CONCAT('%', :pattern, '%') ESCAPE '!' ORDER BY n.updatedAt DESC")
    List<Note> searchByContent(@Param("studId") Long studId, @Param("courseId") Long courseId,
                               @Param("pattern") String pattern, Pageable pageable);
}
