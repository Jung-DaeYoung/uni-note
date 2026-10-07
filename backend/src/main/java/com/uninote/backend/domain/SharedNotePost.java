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

// 노트 공유 게시판 글. 공유 시점의 노트 트리를 SharedNoteSnapshot으로 복사해 두므로
// 원본 노트를 수정·삭제해도 공유본은 바뀌지 않는다. 글을 삭제하면 스냅샷·댓글도 함께 삭제된다.
@Entity
@Table(name = "shared_note_posts")
@Getter @Setter
@NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class SharedNotePost {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "shared_note_post_id")
    private Long sharedNotePostId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stud_id", nullable = false)
    private Student student; // 공유한 학생(작성자)

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    // 원본 루트 노트 ID. 원본이 삭제돼도 글은 남아야 하므로 FK가 아닌 값으로만 보관한다.
    @Column(nullable = false, unique = true)
    private Long sourceRootNoteId;

    private String title; // 공유 시점의 루트 노트 제목

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "sharedNotePost", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("snapshotId ASC")
    private List<SharedNoteSnapshot> snapshots = new ArrayList<>();

    @OneToMany(mappedBy = "sharedNotePost", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SharedNoteComment> comments = new ArrayList<>();
}
