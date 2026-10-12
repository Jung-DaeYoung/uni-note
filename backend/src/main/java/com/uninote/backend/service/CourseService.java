package com.uninote.backend.service;

import com.uninote.backend.domain.Course;
import com.uninote.backend.domain.QuizSet;
import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.CourseResponse;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.exception.ResourceNotFoundException;
import com.uninote.backend.repository.CourseRepository;
import com.uninote.backend.repository.NoteRepository;
import com.uninote.backend.repository.QuizSetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 사용자가 직접 만든 강의의 생성·이름 변경·삭제. 소유자에게 Enrollment를 만들지 않으며,
// 노트 접근은 NoteService가 "수강 중이거나 본인이 만든 강의"로 허용한다.
// 직접 생성 강의에는 게시판·공유를 열지 않으므로 이 강의를 참조하는 데이터는 소유자의 노트와 퀴즈뿐이다.
@Service
@RequiredArgsConstructor
public class CourseService {
    private final CourseRepository courseRepository;
    private final NoteRepository noteRepository;
    private final QuizSetRepository quizSetRepository;
    private final QuizService quizService;

    @Transactional
    public CourseResponse create(String courseName, Student student) {
        Course course = new Course();
        course.setCourseName(courseName.trim());
        course.setOwner(student);
        course.setUserCreated(true);
        return DashboardService.toCourseResponse(courseRepository.save(course));
    }

    @Transactional
    public CourseResponse rename(Long courseId, String courseName, Student student) {
        Course course = getOwnedCourse(courseId, student, "본인이 만든 강의만 수정할 수 있습니다.");
        course.setCourseName(courseName.trim());
        return DashboardService.toCourseResponse(course);
    }

    // 퀴즈(오답노트 항목·답안 정리는 deleteQuiz가 함께 처리) → 루트 노트(하위 노트는 cascade) → 강의 순으로
    // 지워 courses를 참조하는 FK가 남지 않게 한다.
    @Transactional
    public void delete(Long courseId, Student student) {
        Course course = getOwnedCourse(courseId, student, "본인이 만든 강의만 삭제할 수 있습니다.");
        for (QuizSet quizSet : quizSetRepository.findByCourse_CourseIdAndStudent_StudId(courseId, student.getStudId())) {
            quizService.deleteQuiz(quizSet.getQuizSetId(), student);
        }
        noteRepository.deleteAll(noteRepository.findByCourse_CourseIdAndParentNoteIsNull(courseId));
        courseRepository.delete(course);
    }

    // 학교 강의(userCreated=false)는 소유자가 없으므로 항상 403이다.
    private Course getOwnedCourse(Long courseId, Student student, String message) {
        Course course = courseRepository.findById(courseId)
            .orElseThrow(() -> new ResourceNotFoundException("강의를 찾을 수 없습니다."));
        if (!course.isUserCreated() || course.getOwner() == null
                || !course.getOwner().getStudId().equals(student.getStudId())) {
            throw new CourseAccessException(message);
        }
        return course;
    }
}
