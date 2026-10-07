package com.uninote.backend.service;

import com.uninote.backend.domain.Course;
import com.uninote.backend.domain.Note;
import com.uninote.backend.domain.QuizSet;
import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.CourseResponse;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.exception.ResourceNotFoundException;
import com.uninote.backend.repository.CourseRepository;
import com.uninote.backend.repository.NoteRepository;
import com.uninote.backend.repository.QuizSetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CourseServiceTest {

    private final CourseRepository courseRepository = mock(CourseRepository.class);
    private final NoteRepository noteRepository = mock(NoteRepository.class);
    private final QuizSetRepository quizSetRepository = mock(QuizSetRepository.class);
    private final QuizService quizService = mock(QuizService.class);

    private final CourseService courseService = new CourseService(
            courseRepository, noteRepository, quizSetRepository, quizService);

    private Student owner;
    private Student other;
    private Course myCourse;
    private Course schoolCourse;

    @BeforeEach
    void setUp() {
        owner = new Student();
        owner.setStudId(1L);
        other = new Student();
        other.setStudId(2L);

        myCourse = new Course();
        myCourse.setCourseId(20L);
        myCourse.setCourseName("내 강의");
        myCourse.setOwner(owner);
        myCourse.setUserCreated(true);

        schoolCourse = new Course();
        schoolCourse.setCourseId(10L);
        schoolCourse.setCourseName("학교 강의");

        when(courseRepository.findById(20L)).thenReturn(Optional.of(myCourse));
        when(courseRepository.findById(10L)).thenReturn(Optional.of(schoolCourse));
    }

    @Test
    void createSavesUserCreatedCourseOwnedByStudentWithoutProfessorOrCode() {
        when(courseRepository.save(any())).thenAnswer(inv -> {
            Course c = inv.getArgument(0);
            c.setCourseId(30L);
            return c;
        });

        CourseResponse response = courseService.create("  자료구조 스터디  ", owner);

        ArgumentCaptor<Course> captor = ArgumentCaptor.forClass(Course.class);
        verify(courseRepository).save(captor.capture());
        Course saved = captor.getValue();
        assertThat(saved.getCourseName()).isEqualTo("자료구조 스터디");
        assertThat(saved.getOwner()).isSameAs(owner);
        assertThat(saved.isUserCreated()).isTrue();
        assertThat(saved.getProfessor()).isNull();
        assertThat(saved.getCourseCode()).isNull();
        assertThat(response.getCourseId()).isEqualTo(30L);
        assertThat(response.isUserCreated()).isTrue();
        assertThat(response.getProfessorName()).isNull();
    }

    @Test
    void ownerCanRename() {
        assertThat(courseService.rename(20L, "새 이름", owner).getCourseName()).isEqualTo("새 이름");
        assertThat(myCourse.getCourseName()).isEqualTo("새 이름");
    }

    @Test
    void othersAndSchoolCoursesCannotBeRenamedOrDeleted() {
        assertThatThrownBy(() -> courseService.rename(20L, "x", other)).isInstanceOf(CourseAccessException.class);
        assertThatThrownBy(() -> courseService.delete(20L, other)).isInstanceOf(CourseAccessException.class);
        assertThatThrownBy(() -> courseService.rename(10L, "x", owner)).isInstanceOf(CourseAccessException.class);
        assertThatThrownBy(() -> courseService.delete(10L, owner)).isInstanceOf(CourseAccessException.class);
        verify(courseRepository, never()).delete(any());
        verifyNoInteractions(quizService);
    }

    @Test
    void missingCourseIsNotFound() {
        when(courseRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> courseService.delete(99L, owner)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void deleteRemovesQuizzesThenRootNotesThenCourse() {
        QuizSet q1 = new QuizSet();
        q1.setQuizSetId(501L);
        QuizSet q2 = new QuizSet();
        q2.setQuizSetId(502L);
        Note root = new Note();
        root.setNoteId(700L);
        when(quizSetRepository.findByCourse_CourseIdAndStudent_StudId(20L, 1L)).thenReturn(List.of(q1, q2));
        when(noteRepository.findByCourse_CourseIdAndParentNoteIsNull(20L)).thenReturn(List.of(root));

        courseService.delete(20L, owner);

        InOrder order = inOrder(quizService, noteRepository, courseRepository);
        order.verify(quizService).deleteQuiz(501L, owner);
        order.verify(quizService).deleteQuiz(502L, owner);
        order.verify(noteRepository).deleteAll(List.of(root));
        order.verify(courseRepository).delete(myCourse);
    }
}
