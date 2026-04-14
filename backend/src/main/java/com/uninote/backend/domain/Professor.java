package com.uninote.backend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity             // 교수 정보를 담는 엔티티
@Table(name = "professors")
@Getter @Setter
@NoArgsConstructor
public class Professor {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "prof_id")
    private Long profId;    // 교수 고유 식별자

    @Column(nullable = false)
    private String name;       // 교수님 성함

    private String department; // 소속 학과
}
