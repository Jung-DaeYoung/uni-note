package com.uninote.backend.service;

import com.uninote.backend.domain.Course;
import com.uninote.backend.domain.Note;
import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.NoteRequest;
import com.uninote.backend.dto.NoteResponse;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.repository.CourseRepository;
import com.uninote.backend.repository.EnrollmentRepository;
import com.uninote.backend.repository.NoteRepository;
import com.uninote.backend.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NoteService {

    private final NoteRepository noteRepository;
    private final CourseRepository courseRepository;
    private final StudentRepository studentRepository;
    private final EnrollmentRepository enrollmentRepository;

    public NoteResponse getNote(Long courseId, String studentNum) {
        Student student = studentRepository.findByStudentNum(studentNum)
                .orElseThrow(() -> new IllegalArgumentException("Invalid student number"));
        validateEnrollment(student, courseId);

        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Invalid course ID"));

        Note note = noteRepository.findByCourseAndStudent(course, student)
                .orElseGet(() -> {
                    Note newNote = new Note();
                    newNote.setCourse(course);
                    newNote.setStudent(student);
                    return newNote;
                });

        return convertToResponse(note);
    }

    @Transactional
    public NoteResponse saveNote(Long courseId, String studentNum, NoteRequest request) {
        Student student = studentRepository.findByStudentNum(studentNum)
                .orElseThrow(() -> new IllegalArgumentException("Invalid student number"));
        validateEnrollment(student, courseId);

        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Invalid course ID"));

        Note note = noteRepository.findByCourseAndStudent(course, student)
                .orElseGet(() -> {
                    Note newNote = new Note();
                    newNote.setCourse(course);
                    newNote.setStudent(student);
                    return newNote;
                });

        note.setGoals(request.getGoals());
        note.setContent(request.getContent());
        note.setQuestions(request.getQuestions());

        Note savedNote = noteRepository.save(note);
        return convertToResponse(savedNote);
    }

    private void validateEnrollment(Student student, Long courseId) {
        if (!enrollmentRepository.existsByStudentAndCourse_CourseId(student, courseId)) {
            throw new CourseAccessException("해당 강의를 수강하지 않습니다.");
        }
    }

    private NoteResponse convertToResponse(Note note) {
        return NoteResponse.builder()
                .noteId(note.getNoteId())
                .courseId(note.getCourse().getCourseId())
                .goals(note.getGoals())
                .content(note.getContent())
                .questions(note.getQuestions())
                .aiSummary(note.getAiSummary())
                .aiQuizData(note.getAiQuizData())
                .updatedAt(note.getUpdatedAt())
                .build();
    }
}
