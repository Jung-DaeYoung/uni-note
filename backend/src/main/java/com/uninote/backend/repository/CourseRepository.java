package com.uninote.backend.repository;

import com.uninote.backend.domain.Course;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

// 강의(Course) 엔티티를 관리하는 저장소 인터페이스
// JpaRepository를 상속받아 기본적인 CRUD 기능을 자동으로 제공받음
@Repository
public interface CourseRepository extends JpaRepository<Course, Long> {
    // 대시보드의 "내가 만든 강의" 목록.
    List<Course> findByOwner_StudIdAndUserCreatedTrueOrderByCourseIdAsc(Long studId);

    // 노트 접근 권한: 수강 강의가 아니어도 본인이 만든 강의면 허용한다.
    boolean existsByCourseIdAndUserCreatedTrueAndOwner_StudId(Long courseId, Long studId);
}
