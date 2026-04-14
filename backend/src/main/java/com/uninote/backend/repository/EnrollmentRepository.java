package com.uninote.backend.repository;

import com.uninote.backend.domain.Enrollment;
import com.uninote.backend.domain.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

// 수강 정보(Enrollment) 엔티티를 관리하는 저장소 인터페이스
@Repository
public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {
    // 학생을 기준으로 수강 중인 모든 강의 목록을 조회
    List<Enrollment> findByStudent(Student student);
    
    // 특정 학생이 특정 강의를 수강 중인지 확인 (권한 검증 등에 사용)
    boolean existsByStudentAndCourse_CourseId(Student student, Long courseId);
}
