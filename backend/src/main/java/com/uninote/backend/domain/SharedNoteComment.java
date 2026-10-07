package com.uninote.backend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

// 노트 공유 게시판 글의 댓글. 글(SharedNotePost)이 삭제되면 함께 삭제된다.
@Entity
@Table(name = "shared_note_comments")
@Getter @Setter
@NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class SharedNoteComment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "comment_id")
    private Long commentId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "shared_note_post_id", nullable = false)
    private SharedNotePost sharedNotePost;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stud_id", nullable = false)
    private Student student;

    @Column(nullable = false)
    private String content; // CommentRequest가 255자로 제한한다

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;
}
