package com.uninote.backend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

// CBT 시험 공유게시판 글. quizSet은 공유 시점에 복사한 스냅샷(소유자 없음)이라, 원본 퀴즈나
// 이 글이 삭제돼도 다른 학생의 풀이 기록·오답노트가 참조하는 문제는 남는다.
@Entity
@Table(name = "shared_quizzes")
@Getter @Setter
@NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class SharedQuiz {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "shared_quiz_id")
    private Long sharedQuizId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "quiz_set_id", nullable = false, unique = true)
    private QuizSet quizSet;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stud_id", nullable = false)
    private Student student; // 공유한 학생(작성자)

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    // 원본 QuizSet ID. 원본이 삭제돼도 글은 남아야 하므로 FK가 아닌 값으로만 보관한다.
    @Column(nullable = false, unique = true)
    private Long sourceQuizSetId;

    @Column(nullable = false)
    private int likeCount = 0;

    @Column(nullable = false)
    private int viewCount = 0;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "sharedQuiz", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SharedQuizLike> likes = new ArrayList<>();
}
