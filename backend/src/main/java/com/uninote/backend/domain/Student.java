package com.uninote.backend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity             // 학생 정보를 담는 JPA 엔티티
@Table(name = "students")
@Getter @Setter
@NoArgsConstructor
public class Student {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "stud_id")
    private Long studId;    // 학생 고유 식별자

    @Column(name = "student_num", unique = true, nullable = false)
    private String studentNum; // 학번 (로그인 시 아이디로 활용 가능, 중복 불가)

    @Column(nullable = false)
    private String name;       // 학생 실명

    @Column(nullable = false)
    private String password;   // 암호화된 비밀번호
}
