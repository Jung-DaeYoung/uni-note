package com.uninote.backend.service;

import com.uninote.backend.domain.Enrollment;
import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.CourseResponse;
import com.uninote.backend.dto.DashboardResponse;
import com.uninote.backend.dto.NoteSummaryResponse;
import com.uninote.backend.dto.PostResponse;
import com.uninote.backend.repository.EnrollmentRepository;
import com.uninote.backend.repository.NoteRepository;
import com.uninote.backend.repository.PostRepository;
import com.uninote.backend.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardService {

    private final EnrollmentRepository enrollmentRepository;
    private final StudentRepository studentRepository;
    private final PostRepository postRepository;
    private final NoteRepository noteRepository; // 추가

    public DashboardResponse getDashboardData(String studentNum) {
        Student student = studentRepository.findByStudentNum(studentNum)
                .orElseThrow(() -> new IllegalArgumentException("학생을 찾을 수 없습니다."));

        List<Enrollment> enrollments = enrollmentRepository.findByStudent(student);

        List<CourseResponse> courseList = enrollments.stream()
                .map(enrollment -> CourseResponse.builder()
                        .courseId(enrollment.getCourse().getCourseId())
                        .courseName(enrollment.getCourse().getCourseName())
                        .courseCode(enrollment.getCourse().getCourseCode())
                        .professorName(enrollment.getCourse().getProfessor().getName())
                        .build())
                .collect(Collectors.toList());

        // 최근 수정된 노트 6개 조회
        List<NoteSummaryResponse> recentNotes = noteRepository.findTop6ByStudentOrderByUpdatedAtDesc(student).stream()
                .map(note -> NoteSummaryResponse.builder()
                        .noteId(note.getNoteId())
                        .courseId(note.getCourse().getCourseId()) // 추가
                        .title(note.getTitle())
                        .courseName(note.getCourse().getCourseName())
                        .updatedAt(note.getUpdatedAt())
                        .build())
                .collect(Collectors.toList());

        // 최신 게시글 5개 조회 및 변환
        List<PostResponse> recentPosts = postRepository.findTop5ByOrderByCreatedAtDesc().stream()
                .map(post -> {
                    String authorName = "익명";
                    boolean isAuthor = false;
                    if (post.getStudent() != null) {
                        isAuthor = post.getStudent().getStudentNum().equals(studentNum);
                        authorName = "익명 " + (post.getStudent().getStudId() % 100);
                    }
                    return PostResponse.builder()
                        .postId(post.getPostId())
                        .courseId(post.getCourse().getCourseId())
                        .courseName(post.getCourse().getCourseName()) // 강의명 추가
                        .title(post.getTitle())
                        .content(post.getContent())
                        .authorName(authorName)
                        .isAuthor(isAuthor)
                        .createdAt(post.getCreatedAt())
                        .build();
                })
                .collect(Collectors.toList());

        return DashboardResponse.builder()
                .studentName(student.getName())
                .courses(courseList)
                .recentPosts(recentPosts)
                .recentNotes(recentNotes) // 최근 노트 추가
                .build();
    }
}
