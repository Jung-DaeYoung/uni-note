package com.uninote.backend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

// CBT 시험 공유게시판 글의 문제별 댓글. 글(SharedQuiz)에 속하므로 글이 삭제되면 함께 삭제된다.
@Entity
@Table(name = "shared_quiz_comments")
@Getter @Setter
@NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class SharedQuizComment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "comment_id")
    private Long commentId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "shared_quiz_id", nullable = false)
    private SharedQuiz sharedQuiz;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question; // 공유 스냅샷의 문제

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stud_id", nullable = false)
    private Student student;

    @Column(nullable = false)
    private String content; // CommentRequest가 255자로 제한한다

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;
}
