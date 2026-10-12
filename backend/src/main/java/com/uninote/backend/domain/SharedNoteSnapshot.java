package com.uninote.backend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// 공유 시점에 복사한 노트 한 장. 부모 관계는 자기참조 FK 대신 원본 노트 ID 값으로 보관한다
// (cascade 삭제 순서에 따른 FK 위반을 피하고, 트리는 조회 시 메모리에서 조립한다).
@Entity
@Table(name = "shared_note_snapshots")
@Getter @Setter
@NoArgsConstructor
public class SharedNoteSnapshot {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "snapshot_id")
    private Long snapshotId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "shared_note_post_id", nullable = false)
    private SharedNotePost sharedNotePost;

    @Column(nullable = false)
    private Long originalNoteId; // 본문 PageLink의 noteId와 맞추는 용도

    private Long parentOriginalNoteId; // 공유 루트는 null

    private String title;

    @Column(columnDefinition = "LONGTEXT")
    private String content; // Tiptap JSON
}
