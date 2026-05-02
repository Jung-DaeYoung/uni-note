package com.uninote.backend.service;

import com.uninote.backend.domain.Course;
import com.uninote.backend.domain.Note;
import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.NoteRequest;
import com.uninote.backend.dto.NoteResponse;
import com.uninote.backend.dto.NoteTreeResponse;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.repository.CourseRepository;
import com.uninote.backend.repository.EnrollmentRepository;
import com.uninote.backend.repository.NoteRepository;
import com.uninote.backend.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NoteService {

    private final NoteRepository noteRepository;
    private final CourseRepository courseRepository;
    private final StudentRepository studentRepository;
    private final EnrollmentRepository enrollmentRepository;

    public NoteResponse getNote(Long noteId, String studentNum) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new IllegalArgumentException("노트를 찾을 수 없습니다."));
        
        validateEnrollment(note.getStudent(), note.getCourse().getCourseId());
        
        return convertToResponse(note);
    }

    public List<NoteTreeResponse> getNoteTree(Long courseId, String studentNum) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("강의를 찾을 수 없습니다."));
        
        List<Note> rootNotes = noteRepository.findByCourseAndParentNoteIsNullOrderByCreatedAtAsc(course);
        return rootNotes.stream()
                .map(this::convertToTreeResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public NoteResponse createNote(Long courseId, Long parentNoteId, String studentNum) {
        log.info("노트 생성 시도: courseId={}, parentNoteId={}, studentNum={}", courseId, parentNoteId, studentNum);
        
        Student student = studentRepository.findByStudentNum(studentNum)
                .orElseThrow(() -> new IllegalArgumentException("학생을 찾을 수 없습니다."));
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("강의를 찾을 수 없습니다."));
        
        validateEnrollment(student, courseId);

        Note note = new Note();
        note.setCourse(course);
        note.setStudent(student);
        note.setTitle("제목 없음");
        
        // Tiptap 초기 빈 문서 구조 설정 (H1 제목 포함)
        String initialContent = "{\"type\":\"doc\",\"content\":[{\"type\":\"heading\",\"attrs\":{\"level\":1},\"content\":[{\"type\":\"text\",\"text\":\"제목 없음\"}]}]}";
        note.setContent(initialContent);
        note.setPreviewText("");
        note.setSearchContent("");
        
        if (parentNoteId != null) {
            Note parent = noteRepository.findById(parentNoteId)
                    .orElseThrow(() -> new IllegalArgumentException("부모 노트를 찾을 수 없습니다."));
            note.setParentNote(parent);
        }

        Note savedNote = noteRepository.save(note);
        log.info("노트 생성 완료: noteId={}", savedNote.getNoteId());
        return convertToResponse(savedNote);
    }

    @Transactional
    public NoteResponse saveNote(Long noteId, NoteRequest request) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new IllegalArgumentException("노트를 찾을 수 없습니다."));

        note.setTitle(request.getTitle());
        note.setContent(request.getContent());
        note.setPreviewText(request.getPreviewText());
        note.setSearchContent(request.getSearchContent());
        
        Note savedNote = noteRepository.save(note);
        return convertToResponse(savedNote);
    }

    @Transactional
    public void deleteNote(Long noteId, String studentNum) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new IllegalArgumentException("노트를 찾을 수 없습니다."));
        
        Student student = studentRepository.findByStudentNum(studentNum)
                .orElseThrow(() -> new IllegalArgumentException("학생을 찾을 수 없습니다."));
        
        validateEnrollment(student, note.getCourse().getCourseId());
        
        noteRepository.delete(note);
    }

    private void validateEnrollment(Student student, Long courseId) {
        if (!enrollmentRepository.existsByStudentAndCourse_CourseId(student, courseId)) {
            throw new CourseAccessException("해당 강의를 수강하지 않습니다.");
        }
    }

    private NoteResponse convertToResponse(Note note) {
        List<NoteResponse.NoteSummary> breadcrumbs = new ArrayList<>();
        Note current = note.getParentNote();
        while (current != null) {
            breadcrumbs.add(new NoteResponse.NoteSummary(current.getNoteId(), current.getTitle()));
            current = current.getParentNote();
        }
        Collections.reverse(breadcrumbs);

        return NoteResponse.builder()
                .noteId(note.getNoteId())
                .courseId(note.getCourse().getCourseId())
                .parentNoteId(note.getParentNote() != null ? note.getParentNote().getNoteId() : null)
                .title(note.getTitle())
                .content(note.getContent())
                .updatedAt(note.getUpdatedAt())
                .breadcrumbs(breadcrumbs)
                .build();
    }

    private NoteTreeResponse convertToTreeResponse(Note note) {
        return NoteTreeResponse.builder()
                .noteId(note.getNoteId())
                .title(note.getTitle())
                .children(note.getChildNotes().stream()
                        .map(this::convertToTreeResponse)
                        .collect(Collectors.toList()))
                .build();
    }
}
