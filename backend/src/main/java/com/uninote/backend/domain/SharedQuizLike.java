package com.uninote.backend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "shared_quiz_likes", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"shared_quiz_id", "stud_id"})
})
@Getter @Setter
@NoArgsConstructor
public class SharedQuizLike {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "shared_quiz_id", nullable = false)
    private SharedQuiz sharedQuiz;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stud_id", nullable = false)
    private Student student;
}
