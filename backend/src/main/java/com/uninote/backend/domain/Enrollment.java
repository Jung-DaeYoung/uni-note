package com.uninote.backend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity             // 학생과 강의 사이의 수강 관계를 정의하는 엔티티
@Table(name = "enrollments",
        uniqueConstraints = @UniqueConstraint(columnNames = {"stud_id", "course_id"})) // 한 강의는 학생당 한 학기에만 둔다(재수강 미지원)
@Getter @Setter
@NoArgsConstructor
public class Enrollment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "enroll_id")
    private Long enrollId;  // 수강 정보 고유 식별자

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stud_id")
    private Student student; // 수강생 (학생)

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id")
    private Course course;   // 수강 중인 강의

    // 수강 학기. 학교 시스템이 등록하므로 앱에서는 읽기만 한다.
    @Column(name = "academic_year", nullable = false)
    private Integer academicYear; // 학년(1~4)

    @Column(nullable = false)
    private Integer semester;     // 학기(1 또는 2)
}
