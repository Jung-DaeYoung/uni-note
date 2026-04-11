package com.uninote.backend.service;

import com.uninote.backend.domain.*;
import com.uninote.backend.dto.*;
import com.uninote.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PostService {

    private final PostRepository postRepository;
    private final CourseRepository courseRepository;
    private final StudentRepository studentRepository;
    private final CommentRepository commentRepository;

    public List<PostResponse> getPosts(Long courseId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Invalid course ID"));

        return postRepository.findByCourseOrderByCreatedAtDesc(course).stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public PostResponse savePost(Long courseId, String studentNum, PostRequest request) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Invalid course ID"));
        Student student = studentRepository.findByStudentNum(studentNum)
                .orElseThrow(() -> new IllegalArgumentException("Invalid student number"));

        Post post = new Post();
        post.setCourse(course);
        post.setStudent(student);
        post.setTitle(request.getTitle());
        post.setContent(request.getContent());
        post.setAnonymous(true); // 항상 익명으로 저장

        Post savedPost = postRepository.save(post);
        return convertToResponse(savedPost);
    }

    @Transactional
    public void addComment(Long postId, String studentNum, String content) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Invalid post ID"));
        Student student = studentRepository.findByStudentNum(studentNum)
                .orElseThrow(() -> new IllegalArgumentException("Invalid student number"));

        Comment comment = Comment.builder()
                .content(content)
                .post(post)
                .student(student)
                .build();
        
        commentRepository.save(comment);
    }

    @Transactional
    public void deletePost(Long postId, String studentNum) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Invalid post ID"));
        
        // 작성자 본인 확인
        if (!post.getStudent().getStudentNum().equals(studentNum)) {
            throw new IllegalArgumentException("작성자 본인만 삭제할 수 있습니다.");
        }
        
        postRepository.delete(post);
    }

    private PostResponse convertToResponse(Post post) {
        String authorName = post.isAnonymous() ? 
                "익명 " + (post.getStudent().getStudId() % 100) : 
                post.getStudent().getName();

        List<CommentResponse> comments = post.getComments().stream()
                .map(c -> CommentResponse.builder()
                        .commentId(c.getCommentId())
                        .content(c.getContent())
                        .authorName("익명 " + (c.getStudent().getStudId() % 100)) // 댓글은 현재 무조건 익명 (엔티티에 필드 추가 필요 시 확장 가능)
                        .createdAt(c.getCreatedAt())
                        .build())
                .collect(Collectors.toList());

        return PostResponse.builder()
                .postId(post.getPostId())
                .courseId(post.getCourse().getCourseId())
                .courseName(post.getCourse().getCourseName()) // 강의명 추가
                .title(post.getTitle())
                .content(post.getContent())
                .authorName(authorName)
                .createdAt(post.getCreatedAt())
                .comments(comments)
                .build();
    }
}
