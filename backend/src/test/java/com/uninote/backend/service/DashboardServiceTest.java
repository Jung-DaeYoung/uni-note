package com.uninote.backend.service;

import com.uninote.backend.domain.Course;
import com.uninote.backend.domain.Enrollment;
import com.uninote.backend.domain.Post;
import com.uninote.backend.domain.Professor;
import com.uninote.backend.domain.Student;
import com.uninote.backend.exception.ResourceNotFoundException;
import com.uninote.backend.repository.EnrollmentRepository;
import com.uninote.backend.repository.NoteRepository;
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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DashboardServiceTest {

    private final EnrollmentRepository enrollmentRepository = mock(EnrollmentRepository.class);
    private final StudentRepository studentRepository = mock(StudentRepository.class);
    private final PostRepository postRepository = mock(PostRepository.class);
    private final NoteRepository noteRepository = mock(NoteRepository.class);

    private final DashboardService dashboardService = new DashboardService(
            enrollmentRepository, studentRepository, postRepository, noteRepository);

    private Student student;
    private Course enrolledCourse;
    private Professor professor;

    @BeforeEach
    void setUp() {
        student = new Student();
        student.setStudId(1L);
        student.setStudentNum("owner-num");
        student.setName("학생");

        professor = new Professor();
        professor.setProfId(1L);
        professor.setName("교수");

        enrolledCourse = new Course();
        enrolledCourse.setCourseId(10L);
        enrolledCourse.setCourseName("수강중인 강의");
        enrolledCourse.setProfessor(professor);

        Enrollment enrollment = new Enrollment();
        enrollment.setStudent(student);
        enrollment.setCourse(enrolledCourse);

        when(studentRepository.findByStudentNum("owner-num")).thenReturn(Optional.of(student));
        when(enrollmentRepository.findByStudent(student)).thenReturn(List.of(enrollment));
        when(noteRepository.findTop6ByStudentOrderByUpdatedAtDesc(student)).thenReturn(Collections.emptyList());
    }

    @Test
    void recentPostsAreScopedToEnrolledCourses() {
        Post post = new Post();
        post.setPostId(100L);
        post.setCourse(enrolledCourse);
        post.setTitle("공지");
        post.setContent("내용");

        when(postRepository.findTop5ByCourseInOrderByCreatedAtDesc(List.of(enrolledCourse)))
                .thenReturn(List.of(post));

        var response = dashboardService.getDashboardData("owner-num");

        assertThat(response.getRecentPosts()).hasSize(1);
        assertThat(response.getRecentPosts().get(0).getPostId()).isEqualTo(100L);
        assertThat(response.getRecentPosts().get(0).getCourseId()).isEqualTo(10L);
        verify(postRepository).findTop5ByCourseInOrderByCreatedAtDesc(List.of(enrolledCourse));
    }

    @Test
    void unenrolledCoursePostIsNotExposedInDashboard() {
        Course otherCourse = new Course();
        otherCourse.setCourseId(999L);
        otherCourse.setCourseName("미수강 강의");

        // 리포지토리 계층에서 이미 수강 강의로 필터링되므로, 이 시나리오에서는
        // 미수강 강의 게시글이 애초에 조회 결과에 포함되지 않는다.
        when(postRepository.findTop5ByCourseInOrderByCreatedAtDesc(List.of(enrolledCourse)))
                .thenReturn(Collections.emptyList());

        var response = dashboardService.getDashboardData("owner-num");

        assertThat(response.getRecentPosts()).isEmpty();
        verify(postRepository, never()).findAll();
    }

    @Test
    void noEnrollmentsProducesEmptyRecentPostsWithoutQueryingRepository() {
        when(enrollmentRepository.findByStudent(student)).thenReturn(Collections.emptyList());

        var response = dashboardService.getDashboardData("owner-num");

        assertThat(response.getRecentPosts()).isEmpty();
        verify(postRepository, never()).findTop5ByCourseInOrderByCreatedAtDesc(any());
    }

    @Test
    void missingStudentIsReportedAsNotFound() {
        when(studentRepository.findByStudentNum("unknown-num")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> dashboardService.getDashboardData("unknown-num"))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
