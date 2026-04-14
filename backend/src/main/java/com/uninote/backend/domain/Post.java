package com.uninote.backend.domain;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity             // 이 클래스가 JPA 엔티티임을 선언 (DB 테이블과 매핑됨)
@Table(name = "posts")
@Getter @Setter     // 모든 필드에 대한 Getter/Setter 메서드 자동 생성 (Lombok)
@NoArgsConstructor  // 파라미터가 없는 기본 생성자 생성
@EntityListeners(AuditingEntityListener.class) // 생성/수정 시간 자동 기록을 위한 리스너
public class Post {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "post_id")
    private Long postId;    // 게시글의 고유 식별자 (Primary Key)

    @ManyToOne(fetch = FetchType.LAZY) // 지연 로딩 설정 (성능 최적화)
    @JoinColumn(name = "course_id")
    private Course course;   // 이 게시글이 속한 강의 (외래키)

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stud_id")
    private Student student; // 실제 작성한 학생 정보 (내부 관리용)

    @Column(nullable = false)
    private String title;    // 게시글 제목

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;  // 게시글 내용 (긴 텍스트를 위해 TEXT 타입 지정)

    @Column(nullable = false)
    private boolean anonymous = true; // 익명 여부 (기본값 true)

    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Comment> comments = new ArrayList<>(); // 게시글에 달린 댓글 리스트

    @CreatedDate
    private LocalDateTime createdAt; // 게시글 생성 시간 (자동 기록)
}
