package com.uninote.backend.repository;

import com.uninote.backend.domain.Course;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

// 강의(Course) 엔티티를 관리하는 저장소 인터페이스
// JpaRepository를 상속받아 기본적인 CRUD 기능을 자동으로 제공받음
@Repository
public interface CourseRepository extends JpaRepository<Course, Long> {
}
