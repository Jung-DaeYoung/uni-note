package com.uninote.backend.service;

import com.uninote.backend.domain.*;
import com.uninote.backend.dto.*;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.exception.ResourceNotFoundException;
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
    private final EnrollmentRepository enrollmentRepository;

    public List<PostResponse> getPosts(Long courseId, String studentNum) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid course ID"));
        Student student = studentRepository.findByStudentNum(studentNum)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid student number"));
        validateEnrollment(student, courseId);

        return postRepository.findByCourseOrderByCreatedAtDesc(course).stream()
                .map(post -> convertToResponse(post, studentNum))
                .collect(Collectors.toList());
    }

    @Transactional
    public PostResponse savePost(Long courseId, String studentNum, PostRequest request) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid course ID"));
        Student student = studentRepository.findByStudentNum(studentNum)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid student number"));
        validateEnrollment(student, courseId);

        Post post = new Post();
        post.setCourse(course);
        post.setStudent(student);
        post.setTitle(request.getTitle());
        post.setContent(request.getContent());
        post.setAnonymous(true); // 항상 익명으로 저장

        Post savedPost = postRepository.save(post);
        return convertToResponse(savedPost, studentNum);
    }

    @Transactional
    public void addComment(Long postId, String studentNum, String content) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid post ID"));
        Student student = studentRepository.findByStudentNum(studentNum)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid student number"));
        validateEnrollment(student, post.getCourse().getCourseId());

        Comment comment = Comment.builder()
                .content(content)
                .post(post)
                .student(student)
                .build();
        
        commentRepository.save(comment);
    }

    @Transactional
    public void updateComment(Long commentId, String studentNum, String content) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid comment ID"));

        // 작성자 본인 확인
        if (!comment.getStudent().getStudentNum().trim().equals(studentNum.trim())) {
            throw new CourseAccessException("작성자 본인만 수정할 수 있습니다.");
        }
        
        comment.setContent(content);
    }

    @Transactional
    public void deleteComment(Long commentId, String studentNum) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid comment ID"));

        // 작성자 본인 확인
        if (!comment.getStudent().getStudentNum().trim().equals(studentNum.trim())) {
            throw new CourseAccessException("작성자 본인만 삭제할 수 있습니다.");
        }
        
        commentRepository.delete(comment);
    }

    @Transactional
    public void deletePost(Long postId, String studentNum) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid post ID"));

        // 작성자 본인 확인
        if (!post.getStudent().getStudentNum().equals(studentNum)) {
            throw new CourseAccessException("작성자 본인만 삭제할 수 있습니다.");
        }
        
        postRepository.delete(post);
    }

    @Transactional
    public PostResponse updatePost(Long postId, String studentNum, PostRequest request) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid post ID"));

        // 작성자 본인 확인
        if (!post.getStudent().getStudentNum().equals(studentNum)) {
            throw new CourseAccessException("작성자 본인만 수정할 수 있습니다.");
        }
        
        post.setTitle(request.getTitle());
        post.setContent(request.getContent());
        
        return convertToResponse(post, studentNum);
    }

    private void validateEnrollment(Student student, Long courseId) {
        if (!enrollmentRepository.existsByStudentAndCourse_CourseId(student, courseId)) {
            throw new CourseAccessException("해당 강의를 수강하지 않습니다.");
        }
    }

    private PostResponse convertToResponse(Post post, String studentNum) {
        String authorName = "익명";
        boolean isPostAuthor = false;
        
        if (post.getStudent() != null && studentNum != null) {
            isPostAuthor = post.getStudent().getStudentNum().trim().equals(studentNum.trim());
            authorName = "익명 " + (post.getStudent().getStudId() % 100);
        }

        List<CommentResponse> comments = post.getComments().stream()
                .map(c -> {
                    boolean isCommentAuthor = c.getStudent() != null && studentNum != null && 
                            c.getStudent().getStudentNum().trim().equals(studentNum.trim());
                    String commentAuthorName = (c.getStudent() != null) ? 
                            "익명 " + (c.getStudent().getStudId() % 100) : "익명";
                    
                    return CommentResponse.builder()
                        .commentId(c.getCommentId())
                        .content(c.getContent())
                        .authorName(commentAuthorName)
                        .isAuthor(isCommentAuthor)
                        .createdAt(c.getCreatedAt())
                        .build();
                })
                .collect(Collectors.toList());

        return PostResponse.builder()
                .postId(post.getPostId())
                .courseId(post.getCourse().getCourseId())
                .courseName(post.getCourse().getCourseName())
                .title(post.getTitle())
                .content(post.getContent())
                .authorName(authorName)
                .isAuthor(isPostAuthor)
                .createdAt(post.getCreatedAt())
                .comments(comments)
                .build();
    }
}
