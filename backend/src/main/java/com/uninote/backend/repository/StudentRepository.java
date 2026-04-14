package com.uninote.backend.repository;

import com.uninote.backend.domain.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

// 학생(Student) 엔티티를 관리하는 저장소 인터페이스
public interface StudentRepository extends JpaRepository<Student, Long> {
    // 학번(StudentNum)을 기준으로 학생 정보를 조회 (로그인 등에 사용)
    Optional<Student> findByStudentNum(String studentNum);
}
