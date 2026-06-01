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

@Entity
@Table(name = "incorrect_note_groups", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"stud_id", "title"})
})
@Getter @Setter
@NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class IncorrectNoteGroup {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stud_id")
    private Student student;

    @Column(nullable = false)
    private String title;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "group", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<IncorrectNoteItem> items = new ArrayList<>();
}
