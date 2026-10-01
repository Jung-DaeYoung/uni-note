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
        Student student = studentRepository.getByStudentNum(studentNum);
        validateEnrollment(student, courseId);

        return postRepository.findByCourseOrderByCreatedAtDesc(course).stream()
                .map(post -> convertToResponse(post, studentNum))
                .collect(Collectors.toList());
    }

    @Transactional
    public PostResponse savePost(Long courseId, String studentNum, PostRequest request) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid course ID"));
        Student student = studentRepository.getByStudentNum(studentNum);
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
        Student student = studentRepository.getByStudentNum(studentNum);
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

        requireAuthor(comment.getStudent(), studentNum, "작성자 본인만 수정할 수 있습니다.");
        
        comment.setContent(content);
    }

    @Transactional
    public void deleteComment(Long commentId, String studentNum) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid comment ID"));

        requireAuthor(comment.getStudent(), studentNum, "작성자 본인만 삭제할 수 있습니다.");
        
        commentRepository.delete(comment);
    }

    @Transactional
    public void deletePost(Long postId, String studentNum) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid post ID"));

        requireAuthor(post.getStudent(), studentNum, "작성자 본인만 삭제할 수 있습니다.");
        
        postRepository.delete(post);
    }

    @Transactional
    public PostResponse updatePost(Long postId, String studentNum, PostRequest request) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid post ID"));

        requireAuthor(post.getStudent(), studentNum, "작성자 본인만 수정할 수 있습니다.");
        
        post.setTitle(request.getTitle());
        post.setContent(request.getContent());
        
        return convertToResponse(post, studentNum);
    }

    private void validateEnrollment(Student student, Long courseId) {
        if (!enrollmentRepository.existsByStudentAndCourse_CourseId(student, courseId)) {
            throw new CourseAccessException("해당 강의를 수강하지 않습니다.");
        }
    }

    private void requireAuthor(Student author, String studentNum, String message) {
        if (!isAuthor(author, studentNum)) {
            throw new CourseAccessException(message);
        }
    }

    private static boolean isAuthor(Student author, String studentNum) {
        return author != null && studentNum != null
                && author.getStudentNum().trim().equals(studentNum.trim());
    }

    private static String anonymousName(Student author) {
        return author == null ? "익명" : "익명 " + (author.getStudId() % 100);
    }

    // 댓글을 뺀 게시글 응답. 대시보드(DashboardService)의 최근 게시글도 이 변환을 쓴다.
    static PostResponse.PostResponseBuilder summaryBuilder(Post post, String studentNum) {
        return PostResponse.builder()
                .postId(post.getPostId())
                .courseId(post.getCourse().getCourseId())
                .courseName(post.getCourse().getCourseName())
                .title(post.getTitle())
                .content(post.getContent())
                .authorName(anonymousName(post.getStudent()))
                .author(isAuthor(post.getStudent(), studentNum))
                .createdAt(post.getCreatedAt());
    }

    private PostResponse convertToResponse(Post post, String studentNum) {
        List<CommentResponse> comments = post.getComments().stream()
                .map(c -> CommentResponse.builder()
                        .commentId(c.getCommentId())
                        .content(c.getContent())
                        .authorName(anonymousName(c.getStudent()))
                        .author(isAuthor(c.getStudent(), studentNum))
                        .createdAt(c.getCreatedAt())
                        .build())
                .collect(Collectors.toList());

        return summaryBuilder(post, studentNum).comments(comments).build();
    }
}
