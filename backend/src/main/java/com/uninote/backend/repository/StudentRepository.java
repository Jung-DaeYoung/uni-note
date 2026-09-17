package com.uninote.backend.repository;

import com.uninote.backend.domain.Student;
import com.uninote.backend.exception.ResourceNotFoundException;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

// 학생(Student) 엔티티를 관리하는 저장소 인터페이스
public interface StudentRepository extends JpaRepository<Student, Long> {
    // 학번(StudentNum)을 기준으로 학생 정보를 조회 (로그인 등에 사용)
    Optional<Student> findByStudentNum(String studentNum);

    // 인증된 요청(JWT principal)의 학번으로 학생을 조회하는 반복 패턴을 통합한다.
    // 로그인처럼 "계정 존재 여부를 노출하면 안 되는" 경로는 이 메서드를 쓰지 않고
    // findByStudentNum(...)을 직접 사용해 기존 401 통일 응답을 유지해야 한다.
    default Student getByStudentNum(String studentNum) {
        return findByStudentNum(studentNum)
                .orElseThrow(() -> new ResourceNotFoundException("해당 학번의 학생을 찾을 수 없습니다: " + studentNum));
    }
}
