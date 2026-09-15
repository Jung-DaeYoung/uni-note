package com.uninote.backend.service;

import com.uninote.backend.domain.Course;
import com.uninote.backend.domain.Note;
import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.NoteRequest;
import com.uninote.backend.dto.NoteResponse;
import com.uninote.backend.dto.NoteTreeResponse;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.exception.ResourceNotFoundException;
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
import java.util.Map;
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
                .orElseThrow(() -> new ResourceNotFoundException("노트를 찾을 수 없습니다."));

        validateOwnership(note, studentNum);

        return convertToResponse(note);
    }

    public List<NoteTreeResponse> getNoteTree(Long courseId, String studentNum) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("강의를 찾을 수 없습니다."));
        Student student = studentRepository.findByStudentNum(studentNum)
                .orElseThrow(() -> new ResourceNotFoundException("학생을 찾을 수 없습니다."));

        validateEnrollment(student, courseId);

        // 노트 하나씩 자식을 재귀적으로 lazy loading하면 트리 크기만큼 쿼리가 늘어난다(N+1).
        // 전체를 한 번에 조회한 뒤 parentNoteId 기준으로 메모리에서 트리를 구성한다.
        List<Note> allNotes = noteRepository.findByCourseAndStudentOrderByCreatedAtAsc(course, student);
        Map<Long, List<Note>> childrenByParentId = allNotes.stream()
                .filter(note -> note.getParentNote() != null)
                .collect(Collectors.groupingBy(note -> note.getParentNote().getNoteId()));
        List<Note> rootNotes = allNotes.stream()
                .filter(note -> note.getParentNote() == null)
                .collect(Collectors.toList());

        return rootNotes.stream()
                .map(note -> convertToTreeResponse(note, childrenByParentId, 0))
                .collect(Collectors.toList());
    }

    @Transactional
    public NoteResponse createNote(Long courseId, Long parentNoteId, String studentNum) {
        log.info("노트 생성 시도: courseId={}, parentNoteId={}, studentNum={}", courseId, parentNoteId, studentNum);
        
        Student student = studentRepository.findByStudentNum(studentNum)
                .orElseThrow(() -> new ResourceNotFoundException("학생을 찾을 수 없습니다."));
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("강의를 찾을 수 없습니다."));

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
                    .orElseThrow(() -> new ResourceNotFoundException("부모 노트를 찾을 수 없습니다."));
            validateParentNote(parent, courseId, studentNum);
            note.setParentNote(parent);
        }

        Note savedNote = noteRepository.save(note);
        log.info("노트 생성 완료: noteId={}", savedNote.getNoteId());
        return convertToResponse(savedNote);
    }

    @Transactional
    public NoteResponse saveNote(Long noteId, String studentNum, NoteRequest request) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new ResourceNotFoundException("노트를 찾을 수 없습니다."));

        validateOwnership(note, studentNum);

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
                .orElseThrow(() -> new ResourceNotFoundException("노트를 찾을 수 없습니다."));

        Student student = studentRepository.findByStudentNum(studentNum)
                .orElseThrow(() -> new ResourceNotFoundException("학생을 찾을 수 없습니다."));
        
        validateEnrollment(student, note.getCourse().getCourseId());
        validateOwnership(note, studentNum);

        noteRepository.delete(note);
    }

    private void validateEnrollment(Student student, Long courseId) {
        if (!enrollmentRepository.existsByStudentAndCourse_CourseId(student, courseId)) {
            throw new CourseAccessException("해당 강의를 수강하지 않습니다.");
        }
    }

    private void validateOwnership(Note note, String studentNum) {
        if (!note.getStudent().getStudentNum().equals(studentNum)) {
            throw new CourseAccessException("본인 노트만 접근할 수 있습니다.");
        }
    }

    // 다른 강의 또는 다른 학생의 노트를 부모로 지정하는 것을 막는다.
    private void validateParentNote(Note parent, Long courseId, String studentNum) {
        if (!parent.getCourse().getCourseId().equals(courseId)) {
            throw new CourseAccessException("부모 노트가 다른 강의에 속해 있습니다.");
        }
        validateOwnership(parent, studentNum);
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

    // 비정상적으로 깊은(또는 순환) 노트 트리가 응답 크기를 무한정 늘리지 않도록 방어적 상한을 둔다.
    // 정상적인 사용 흐름에서는 도달하지 않는 값이다.
    private static final int MAX_TREE_DEPTH = 20;

    private NoteTreeResponse convertToTreeResponse(Note note, Map<Long, List<Note>> childrenByParentId, int depth) {
        List<NoteTreeResponse> children = depth >= MAX_TREE_DEPTH
                ? Collections.emptyList()
                : childrenByParentId.getOrDefault(note.getNoteId(), Collections.emptyList()).stream()
                        .map(child -> convertToTreeResponse(child, childrenByParentId, depth + 1))
                        .collect(Collectors.toList());

        return NoteTreeResponse.builder()
                .noteId(note.getNoteId())
                .title(note.getTitle())
                .children(children)
                .build();
    }
}
