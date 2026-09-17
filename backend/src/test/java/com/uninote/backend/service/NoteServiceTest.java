package com.uninote.backend.service;

import com.uninote.backend.domain.Course;
import com.uninote.backend.domain.Note;
import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.NoteRequest;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.exception.ResourceNotFoundException;
import com.uninote.backend.repository.CourseRepository;
import com.uninote.backend.repository.EnrollmentRepository;
import com.uninote.backend.repository.NoteRepository;
import com.uninote.backend.repository.StudentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class NoteServiceTest {

    private final NoteRepository noteRepository = mock(NoteRepository.class);
    private final CourseRepository courseRepository = mock(CourseRepository.class);
    private final StudentRepository studentRepository = mock(StudentRepository.class);
    private final EnrollmentRepository enrollmentRepository = mock(EnrollmentRepository.class);
    private final NoteService noteService = new NoteService(
            noteRepository, courseRepository, studentRepository, enrollmentRepository);

    private Student owner;
    private Student other;
    private Course course;
    private Note note;

    @BeforeEach
    void setUp() {
        // StudentRepository.getByStudentNum(...)은 default 메서드라 mock()이 실제 본문을 실행하지 않는다.
        // 각 테스트가 개별적으로 stub하는 findByStudentNum(...)에 위임하도록 한 번만 연결해준다.
        lenient().when(studentRepository.getByStudentNum(anyString()))
                .thenAnswer(invocation -> studentRepository.findByStudentNum(invocation.getArgument(0))
                        .orElseThrow(() -> new ResourceNotFoundException("학생을 찾을 수 없습니다.")));

        owner = new Student();
        owner.setStudId(1L);
        owner.setStudentNum("owner-num");

        other = new Student();
        other.setStudId(2L);
        other.setStudentNum("other-num");

        course = new Course();
        course.setCourseId(10L);

        note = new Note();
        note.setNoteId(100L);
        note.setCourse(course);
        note.setStudent(owner);
        note.setTitle("제목");
        note.setContent("내용");
    }

    @Test
    void ownerCanGetOwnNote() {
        when(noteRepository.findById(100L)).thenReturn(Optional.of(note));

        var response = noteService.getNote(100L, "owner-num");

        assertThat(response.getNoteId()).isEqualTo(100L);
    }

    @Test
    void getNoteThrowsResourceNotFoundWhenNoteDoesNotExist() {
        when(noteRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> noteService.getNote(999L, "owner-num"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void otherStudentCannotGetSomeoneElsesNote() {
        when(noteRepository.findById(100L)).thenReturn(Optional.of(note));

        assertThatThrownBy(() -> noteService.getNote(100L, "other-num"))
                .isInstanceOf(CourseAccessException.class);
    }

    @Test
    void ownerCanSaveOwnNote() {
        when(noteRepository.findById(100L)).thenReturn(Optional.of(note));
        when(noteRepository.save(any(Note.class))).thenAnswer(invocation -> invocation.getArgument(0));

        NoteRequest request = new NoteRequest("새 제목", "새 내용", "미리보기", "검색용");
        var response = noteService.saveNote(100L, "owner-num", request);

        assertThat(response.getTitle()).isEqualTo("새 제목");
    }

    @Test
    void otherStudentCannotSaveSomeoneElsesNote() {
        when(noteRepository.findById(100L)).thenReturn(Optional.of(note));

        NoteRequest request = new NoteRequest("해킹", "해킹", "", "");

        assertThatThrownBy(() -> noteService.saveNote(100L, "other-num", request))
                .isInstanceOf(CourseAccessException.class);
    }

    @Test
    void ownerCanDeleteOwnNoteWhenEnrolled() {
        when(noteRepository.findById(100L)).thenReturn(Optional.of(note));
        when(studentRepository.findByStudentNum("owner-num")).thenReturn(Optional.of(owner));
        when(enrollmentRepository.existsByStudentAndCourse_CourseId(owner, 10L)).thenReturn(true);

        noteService.deleteNote(100L, "owner-num");

        org.mockito.Mockito.verify(noteRepository).delete(note);
    }

    @Test
    void enrolledStudentCannotDeleteAnotherStudentsNoteInSameCourse() {
        when(noteRepository.findById(100L)).thenReturn(Optional.of(note));
        when(studentRepository.findByStudentNum("other-num")).thenReturn(Optional.of(other));
        // 같은 강의를 수강 중이더라도 노트 소유자는 아님
        when(enrollmentRepository.existsByStudentAndCourse_CourseId(other, 10L)).thenReturn(true);

        assertThatThrownBy(() -> noteService.deleteNote(100L, "other-num"))
                .isInstanceOf(CourseAccessException.class);

        org.mockito.Mockito.verify(noteRepository, org.mockito.Mockito.never()).delete(any(Note.class));
    }

    @Test
    void getNoteTreeRejectsNonEnrolledStudent() {
        when(courseRepository.findById(10L)).thenReturn(Optional.of(course));
        when(studentRepository.findByStudentNum("other-num")).thenReturn(Optional.of(other));
        when(enrollmentRepository.existsByStudentAndCourse_CourseId(other, 10L)).thenReturn(false);

        assertThatThrownBy(() -> noteService.getNoteTree(10L, "other-num"))
                .isInstanceOf(CourseAccessException.class);
    }

    @Test
    void createNoteSucceedsForRootNoteWhenEnrolled() {
        when(studentRepository.findByStudentNum("owner-num")).thenReturn(Optional.of(owner));
        when(courseRepository.findById(10L)).thenReturn(Optional.of(course));
        when(enrollmentRepository.existsByStudentAndCourse_CourseId(owner, 10L)).thenReturn(true);
        when(noteRepository.save(any(Note.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = noteService.createNote(10L, null, "owner-num");

        assertThat(response.getCourseId()).isEqualTo(10L);
    }

    @Test
    void createNoteSucceedsWithParentNoteInSameCourseOwnedByStudent() {
        when(studentRepository.findByStudentNum("owner-num")).thenReturn(Optional.of(owner));
        when(courseRepository.findById(10L)).thenReturn(Optional.of(course));
        when(enrollmentRepository.existsByStudentAndCourse_CourseId(owner, 10L)).thenReturn(true);
        when(noteRepository.findById(100L)).thenReturn(Optional.of(note));
        when(noteRepository.save(any(Note.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = noteService.createNote(10L, 100L, "owner-num");

        assertThat(response.getParentNoteId()).isEqualTo(100L);
    }

    @Test
    void createNoteRejectsParentNoteFromAnotherCourse() {
        Course anotherCourse = new Course();
        anotherCourse.setCourseId(20L);
        Note parentInAnotherCourse = new Note();
        parentInAnotherCourse.setNoteId(200L);
        parentInAnotherCourse.setCourse(anotherCourse);
        parentInAnotherCourse.setStudent(owner);

        when(studentRepository.findByStudentNum("owner-num")).thenReturn(Optional.of(owner));
        when(courseRepository.findById(10L)).thenReturn(Optional.of(course));
        when(enrollmentRepository.existsByStudentAndCourse_CourseId(owner, 10L)).thenReturn(true);
        when(noteRepository.findById(200L)).thenReturn(Optional.of(parentInAnotherCourse));

        assertThatThrownBy(() -> noteService.createNote(10L, 200L, "owner-num"))
                .isInstanceOf(CourseAccessException.class);

        org.mockito.Mockito.verify(noteRepository, org.mockito.Mockito.never()).save(any(Note.class));
    }

    @Test
    void createNoteRejectsParentNoteOwnedByAnotherStudent() {
        Note someoneElsesNote = new Note();
        someoneElsesNote.setNoteId(300L);
        someoneElsesNote.setCourse(course);
        someoneElsesNote.setStudent(other);

        when(studentRepository.findByStudentNum("owner-num")).thenReturn(Optional.of(owner));
        when(courseRepository.findById(10L)).thenReturn(Optional.of(course));
        when(enrollmentRepository.existsByStudentAndCourse_CourseId(owner, 10L)).thenReturn(true);
        when(noteRepository.findById(300L)).thenReturn(Optional.of(someoneElsesNote));

        assertThatThrownBy(() -> noteService.createNote(10L, 300L, "owner-num"))
                .isInstanceOf(CourseAccessException.class);

        org.mockito.Mockito.verify(noteRepository, org.mockito.Mockito.never()).save(any(Note.class));
    }

    @Test
    void createNoteThrowsResourceNotFoundWhenParentDoesNotExist() {
        when(studentRepository.findByStudentNum("owner-num")).thenReturn(Optional.of(owner));
        when(courseRepository.findById(10L)).thenReturn(Optional.of(course));
        when(enrollmentRepository.existsByStudentAndCourse_CourseId(owner, 10L)).thenReturn(true);
        when(noteRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> noteService.createNote(10L, 999L, "owner-num"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void createNoteRejectsWhenNotEnrolled() {
        when(studentRepository.findByStudentNum("other-num")).thenReturn(Optional.of(other));
        when(courseRepository.findById(10L)).thenReturn(Optional.of(course));
        when(enrollmentRepository.existsByStudentAndCourse_CourseId(other, 10L)).thenReturn(false);

        assertThatThrownBy(() -> noteService.createNote(10L, null, "other-num"))
                .isInstanceOf(CourseAccessException.class);

        org.mockito.Mockito.verify(noteRepository, org.mockito.Mockito.never()).save(any(Note.class));
    }

    @Test
    void getNoteTreeScopesRootNotesToRequestingStudent() {
        when(courseRepository.findById(10L)).thenReturn(Optional.of(course));
        when(studentRepository.findByStudentNum("owner-num")).thenReturn(Optional.of(owner));
        when(enrollmentRepository.existsByStudentAndCourse_CourseId(owner, 10L)).thenReturn(true);
        when(noteRepository.findByCourseAndStudentOrderByCreatedAtAsc(course, owner))
                .thenReturn(List.of(note));

        var tree = noteService.getNoteTree(10L, "owner-num");

        assertThat(tree).hasSize(1);
        assertThat(tree.get(0).getNoteId()).isEqualTo(100L);
        org.mockito.Mockito.verify(noteRepository)
                .findByCourseAndStudentOrderByCreatedAtAsc(course, owner);
    }

    @Test
    void getNoteTreeBuildsNestedChildrenFromSingleQueryWithoutExtraRepositoryCalls() {
        Note child = new Note();
        child.setNoteId(101L);
        child.setTitle("자식 노트");
        child.setCourse(course);
        child.setStudent(owner);
        child.setParentNote(note);

        Note grandchild = new Note();
        grandchild.setNoteId(102L);
        grandchild.setTitle("손자 노트");
        grandchild.setCourse(course);
        grandchild.setStudent(owner);
        grandchild.setParentNote(child);

        when(courseRepository.findById(10L)).thenReturn(Optional.of(course));
        when(studentRepository.findByStudentNum("owner-num")).thenReturn(Optional.of(owner));
        when(enrollmentRepository.existsByStudentAndCourse_CourseId(owner, 10L)).thenReturn(true);
        // 트리 전체를 한 번의 조회로 가져온다고 가정 - 자식 개수만큼 추가로 조회하지 않는다.
        when(noteRepository.findByCourseAndStudentOrderByCreatedAtAsc(course, owner))
                .thenReturn(List.of(note, child, grandchild));

        var tree = noteService.getNoteTree(10L, "owner-num");

        assertThat(tree).hasSize(1);
        assertThat(tree.get(0).getChildren()).hasSize(1);
        assertThat(tree.get(0).getChildren().get(0).getNoteId()).isEqualTo(101L);
        assertThat(tree.get(0).getChildren().get(0).getChildren()).hasSize(1);
        assertThat(tree.get(0).getChildren().get(0).getChildren().get(0).getNoteId()).isEqualTo(102L);
        // 노트 트리 조회는 findByCourseAndStudentOrderByCreatedAtAsc 단 한 번만 호출한다(N+1 없음).
        org.mockito.Mockito.verify(noteRepository, org.mockito.Mockito.times(1))
                .findByCourseAndStudentOrderByCreatedAtAsc(any(), any());
        org.mockito.Mockito.verifyNoMoreInteractions(noteRepository);
    }
}
