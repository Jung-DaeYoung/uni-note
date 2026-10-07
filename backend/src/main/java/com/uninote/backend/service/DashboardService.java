package com.uninote.backend.service;

import com.uninote.backend.domain.Course;
import com.uninote.backend.domain.Enrollment;
import com.uninote.backend.domain.Post;
import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.CourseResponse;
import com.uninote.backend.dto.DashboardResponse;
import com.uninote.backend.dto.NoteSummaryResponse;
import com.uninote.backend.dto.PostResponse;
import com.uninote.backend.repository.CourseRepository;
import com.uninote.backend.repository.EnrollmentRepository;
import com.uninote.backend.repository.NoteRepository;
import com.uninote.backend.repository.PostRepository;
import com.uninote.backend.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardService {

    private final EnrollmentRepository enrollmentRepository;
    private final StudentRepository studentRepository;
    private final PostRepository postRepository;
    private final NoteRepository noteRepository; // 추가
    private final CourseRepository courseRepository;

    public DashboardResponse getDashboardData(String studentNum) {
        Student student = studentRepository.getByStudentNum(studentNum);

        List<Enrollment> enrollments = enrollmentRepository.findByStudent(student);

        // 수강 강의 다음에 본인이 직접 만든 강의를 붙인다(소유자에게는 Enrollment가 없다).
        List<CourseResponse> courseList = Stream.concat(
                        enrollments.stream().map(Enrollment::getCourse),
                        courseRepository.findByOwner_StudIdAndUserCreatedTrueOrderByCourseIdAsc(student.getStudId()).stream())
                .map(DashboardService::toCourseResponse)
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

        // 최신 게시글 5개 조회 및 변환 (수강 중인 강의로 범위 한정)
        List<Course> enrolledCourses = enrollments.stream()
                .map(Enrollment::getCourse)
                .collect(Collectors.toList());

        List<PostResponse> recentPosts = (enrolledCourses.isEmpty()
                ? List.<Post>of()
                : postRepository.findTop5ByCourseInOrderByCreatedAtDesc(enrolledCourses))
                .stream()
                .map(post -> PostService.summaryBuilder(post, studentNum).build())
                .collect(Collectors.toList());

        return DashboardResponse.builder()
                .studentName(student.getName())
                .courses(courseList)
                .recentPosts(recentPosts)
                .recentNotes(recentNotes) // 최근 노트 추가
                .build();
    }

    // 직접 생성 강의는 교수·강의코드가 없으므로 null로 내려준다.
    static CourseResponse toCourseResponse(Course course) {
        return CourseResponse.builder()
                .courseId(course.getCourseId())
                .courseName(course.getCourseName())
                .courseCode(course.getCourseCode())
                .professorName(course.getProfessor() != null ? course.getProfessor().getName() : null)
                .userCreated(course.isUserCreated())
                .build();
    }
}
