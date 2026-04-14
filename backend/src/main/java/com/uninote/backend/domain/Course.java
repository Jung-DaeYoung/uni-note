package com.uninote.backend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity             // 강의 정보를 담는 JPA 엔티티
@Table(name = "courses")
@Getter @Setter
@NoArgsConstructor
public class Course {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "course_id")
    private Long courseId;  // 강의 고유 식별자

    @Column(name = "course_name", nullable = false)
    private String courseName; // 강의명 (예: 소프트웨어 공학)

    @Column(name = "course_code", unique = true)
    private String courseCode; // 학수 번호 (예: CS101)

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prof_id")
    private Professor professor; // 해당 강의를 담당하는 교수님
}
