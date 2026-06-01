package com.uninote.backend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "incorrect_note_items", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"group_id", "question_id"})
})
@Getter @Setter
@NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class IncorrectNoteItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id")
    private IncorrectNoteGroup group;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id")
    private Question question;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime addedAt;
}
