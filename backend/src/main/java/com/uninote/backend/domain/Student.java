package com.uninote.backend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "students")
@Getter @Setter
@NoArgsConstructor
public class Student {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long studId;

    @Column(unique = true, nullable = false)
    private String studentNum;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String password;

    private String major;
}
