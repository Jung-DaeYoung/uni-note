package com.uninote.backend.service;

import com.uninote.backend.domain.Course;
import com.uninote.backend.domain.Post;
import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.PostRequest;
import com.uninote.backend.domain.Comment;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.exception.ResourceNotFoundException;
import com.uninote.backend.repository.CommentRepository;
import com.uninote.backend.repository.CourseRepository;
import com.uninote.backend.repository.EnrollmentRepository;
import com.uninote.backend.repository.PostRepository;
import com.uninote.backend.repository.StudentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PostServiceTest {

    private final PostRepository postRepository = mock(PostRepository.class);
    private final CourseRepository courseRepository = mock(CourseRepository.class);
    private final StudentRepository studentRepository = mock(StudentRepository.class);
    private final CommentRepository commentRepository = mock(CommentRepository.class);
    private final EnrollmentRepository enrollmentRepository = mock(EnrollmentRepository.class);

    private final PostService postService = new PostService(
            postRepository, courseRepository, studentRepository, commentRepository, enrollmentRepository);

    private Student enrolledStudent;
    private Student outsiderStudent;
    private Course course;
    private Post post;

    @BeforeEach
    void setUp() {
        // StudentRepository.getByStudentNum(...)은 default 메서드라 mock()이 실제 본문을 실행하지 않는다.
        // 각 테스트가 개별적으로 stub하는 findByStudentNum(...)에 위임하도록 한 번만 연결해준다.
        lenient().when(studentRepository.getByStudentNum(anyString()))
                .thenAnswer(invocation -> studentRepository.findByStudentNum(invocation.getArgument(0))
                        .orElseThrow(() -> new ResourceNotFoundException("학생을 찾을 수 없습니다.")));

        enrolledStudent = new Student();
        enrolledStudent.setStudId(1L);
        enrolledStudent.setStudentNum("enrolled-num");

        outsiderStudent = new Student();
        outsiderStudent.setStudId(2L);
        outsiderStudent.setStudentNum("outsider-num");

        course = new Course();
        course.setCourseId(10L);
        course.setCourseName("강의");

        post = new Post();
        post.setPostId(100L);
        post.setCourse(course);
        post.setStudent(enrolledStudent);
        post.setTitle("제목");
        post.setContent("내용");
        post.setComments(Collections.emptyList());

        when(courseRepository.findById(10L)).thenReturn(Optional.of(course));
        when(studentRepository.findByStudentNum("enrolled-num")).thenReturn(Optional.of(enrolledStudent));
        when(studentRepository.findByStudentNum("outsider-num")).thenReturn(Optional.of(outsiderStudent));
        when(enrollmentRepository.existsByStudentAndCourse_CourseId(enrolledStudent, 10L)).thenReturn(true);
        when(enrollmentRepository.existsByStudentAndCourse_CourseId(outsiderStudent, 10L)).thenReturn(false);
    }

    @Test
    void enrolledStudentCanListPosts() {
        when(postRepository.findByCourseOrderByCreatedAtDesc(course)).thenReturn(List.of(post));

        List<?> posts = postService.getPosts(10L, "enrolled-num");

        assertThat(posts).hasSize(1);
    }

    @Test
    void nonEnrolledStudentCannotListPosts() {
        assertThatThrownBy(() -> postService.getPosts(10L, "outsider-num"))
                .isInstanceOf(CourseAccessException.class);

        verify(postRepository, never()).findByCourseOrderByCreatedAtDesc(any());
    }

    @Test
    void enrolledStudentCanCreatePost() {
        when(postRepository.save(any(Post.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = postService.savePost(10L, "enrolled-num", new PostRequest("제목", "내용"));

        assertThat(response.getTitle()).isEqualTo("제목");
        verify(postRepository).save(any(Post.class));
    }

    @Test
    void nonEnrolledStudentCannotCreatePost() {
        assertThatThrownBy(() -> postService.savePost(10L, "outsider-num", new PostRequest("제목", "내용")))
                .isInstanceOf(CourseAccessException.class);

        verify(postRepository, never()).save(any());
    }

    @Test
    void enrolledStudentCanCommentOnPost() {
        when(postRepository.findById(100L)).thenReturn(Optional.of(post));

        postService.addComment(100L, "enrolled-num", "댓글");

        verify(commentRepository).save(any());
    }

    @Test
    void nonEnrolledStudentCannotCommentOnPost() {
        when(postRepository.findById(100L)).thenReturn(Optional.of(post));

        assertThatThrownBy(() -> postService.addComment(100L, "outsider-num", "댓글"))
                .isInstanceOf(CourseAccessException.class);

        verify(commentRepository, never()).save(any());
    }

    @Test
    void gettingPostsForMissingCourseIsNotFound() {
        when(courseRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> postService.getPosts(999L, "enrolled-num"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void commentingOnMissingPostIsNotFound() {
        when(postRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> postService.addComment(999L, "enrolled-num", "댓글"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void deletingMissingPostIsNotFound() {
        when(postRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> postService.deletePost(999L, "enrolled-num"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void deletingOthersPostIsForbidden() {
        when(postRepository.findById(100L)).thenReturn(Optional.of(post));

        assertThatThrownBy(() -> postService.deletePost(100L, "outsider-num"))
                .isInstanceOf(CourseAccessException.class);

        verify(postRepository, never()).delete(any());
    }

    @Test
    void updatingOthersPostIsForbidden() {
        when(postRepository.findById(100L)).thenReturn(Optional.of(post));

        assertThatThrownBy(() -> postService.updatePost(100L, "outsider-num", new PostRequest("새 제목", "새 내용")))
                .isInstanceOf(CourseAccessException.class);
    }

    @Test
    void authorCanDeleteOwnPost() {
        when(postRepository.findById(100L)).thenReturn(Optional.of(post));

        postService.deletePost(100L, "enrolled-num");

        verify(postRepository).delete(post);
    }

    @Test
    void deletingMissingCommentIsNotFound() {
        when(commentRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> postService.deleteComment(999L, "enrolled-num"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void deletingOthersCommentIsForbidden() {
        Comment comment = Comment.builder()
                .commentId(200L)
                .content("댓글")
                .post(post)
                .student(enrolledStudent)
                .build();
        when(commentRepository.findById(200L)).thenReturn(Optional.of(comment));

        assertThatThrownBy(() -> postService.deleteComment(200L, "outsider-num"))
                .isInstanceOf(CourseAccessException.class);

        verify(commentRepository, never()).delete(any());
    }

    @Test
    void authorCanDeleteOwnComment() {
        Comment comment = Comment.builder()
                .commentId(200L)
                .content("댓글")
                .post(post)
                .student(enrolledStudent)
                .build();
        when(commentRepository.findById(200L)).thenReturn(Optional.of(comment));

        postService.deleteComment(200L, "enrolled-num");

        verify(commentRepository).delete(comment);
    }
}
