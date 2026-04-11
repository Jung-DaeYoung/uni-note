package com.uninote.backend.repository;

import com.uninote.backend.domain.Enrollment;
import com.uninote.backend.domain.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {
    List<Enrollment> findByStudent(Student student);
    boolean existsByStudentAndCourse_CourseId(Student student, Long courseId);
}
