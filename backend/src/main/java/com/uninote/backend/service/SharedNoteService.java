package com.uninote.backend.service;

import com.uninote.backend.domain.*;
import com.uninote.backend.dto.CommentResponse;
import com.uninote.backend.dto.SharedNoteDetailResponse;
import com.uninote.backend.dto.SharedNoteResponse;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.exception.InvalidRequestException;
import com.uninote.backend.exception.ResourceNotFoundException;
import com.uninote.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

// 노트 공유 게시판. 공유 시 노트와 모든 하위 노트를 스냅샷으로 복사하므로, 원본 노트의
// 작성자 전용 권한(NoteService)은 그대로 두고 같은 강의 수강생에게 읽기 전용으로 보여 준다.
@Service
@RequiredArgsConstructor
public class SharedNoteService {
    private final SharedNotePostRepository sharedNotePostRepository;
    private final SharedNoteCommentRepository sharedNoteCommentRepository;
    private final NoteRepository noteRepository;
    private final EnrollmentRepository enrollmentRepository;

    // ponytail: 페이지네이션 없이 수강 강의의 글 전체를 반환한다. 글이 많아지면 Pageable로 바꾼다.
    @Transactional(readOnly = true)
    public List<SharedNoteResponse> getSharedNotes(Student student, Long courseId) {
        List<Long> courseIds;
        if (courseId != null) {
            validateEnrollment(student, courseId);
            courseIds = List.of(courseId);
        } else {
            courseIds = enrollmentRepository.findByStudent(student).stream()
                .map(e -> e.getCourse().getCourseId())
                .collect(Collectors.toList());
        }
        if (courseIds.isEmpty()) {
            return List.of();
        }
        return sharedNotePostRepository.findByCourseIds(courseIds).stream()
            .map(p -> SharedNoteResponse.builder()
                .sharedNotePostId(p.getSharedNotePostId())
                .courseId(p.getCourse().getCourseId())
                .courseName(p.getCourse().getCourseName())
                .title(p.getTitle())
                .authorName(PostService.anonymousName(p.getStudent()))
                .author(isSameStudent(p.getStudent(), student))
                .createdAt(p.getCreatedAt())
                .build())
            .collect(Collectors.toList());
    }

    @Transactional
    public void share(Long rootNoteId, Student student) {
        Note root = noteRepository.findById(rootNoteId)
            .orElseThrow(() -> new ResourceNotFoundException("노트를 찾을 수 없습니다."));
        if (root.getStudent() == null || !isSameStudent(root.getStudent(), student)) {
            throw new CourseAccessException("본인 노트만 공유할 수 있습니다.");
        }
        if (root.getCourse() == null) {
            throw new InvalidRequestException("강의가 없는 노트는 공유할 수 없습니다.");
        }
        if (root.getCourse().isUserCreated()) {
            throw new InvalidRequestException("직접 만든 강의의 노트는 공유할 수 없습니다.");
        }
        validateEnrollment(student, root.getCourse().getCourseId());
        if (sharedNotePostRepository.existsBySourceRootNoteId(rootNoteId)) {
            throw new InvalidRequestException("이미 공유된 노트입니다.");
        }

        SharedNotePost post = new SharedNotePost();
        post.setStudent(student);
        post.setCourse(root.getCourse());
        post.setSourceRootNoteId(rootNoteId);
        post.setTitle(root.getTitle());
        for (Note note : collectSubtree(root, student)) {
            SharedNoteSnapshot snapshot = new SharedNoteSnapshot();
            snapshot.setSharedNotePost(post);
            snapshot.setOriginalNoteId(note.getNoteId());
            snapshot.setParentOriginalNoteId(note == root ? null : note.getParentNote().getNoteId());
            snapshot.setTitle(note.getTitle());
            snapshot.setContent(note.getContent());
            post.getSnapshots().add(snapshot);
        }
        sharedNotePostRepository.save(post);
    }

    @Transactional(readOnly = true)
    public SharedNoteDetailResponse getDetail(Long postId, Student student) {
        SharedNotePost post = getPost(postId);
        validateEnrollment(student, post.getCourse().getCourseId());

        Map<Long, List<SharedNoteSnapshot>> childrenByParent = post.getSnapshots().stream()
            .filter(s -> s.getParentOriginalNoteId() != null)
            .collect(Collectors.groupingBy(SharedNoteSnapshot::getParentOriginalNoteId));
        List<SharedNoteDetailResponse.Node> roots = post.getSnapshots().stream()
            .filter(s -> s.getParentOriginalNoteId() == null)
            .map(s -> toNode(s, childrenByParent))
            .collect(Collectors.toList());

        return SharedNoteDetailResponse.builder()
            .sharedNotePostId(post.getSharedNotePostId())
            .courseId(post.getCourse().getCourseId())
            .courseName(post.getCourse().getCourseName())
            .title(post.getTitle())
            .authorName(PostService.anonymousName(post.getStudent()))
            .author(isSameStudent(post.getStudent(), student))
            .createdAt(post.getCreatedAt())
            .notes(roots)
            .build();
    }

    @Transactional
    public void deletePost(Long postId, Student student) {
        SharedNotePost post = getPost(postId);
        if (!isSameStudent(post.getStudent(), student)) {
            throw new CourseAccessException("작성자 본인만 삭제할 수 있습니다.");
        }
        sharedNotePostRepository.delete(post);
    }

    @Transactional(readOnly = true)
    public List<CommentResponse> getComments(Long postId, Student student) {
        SharedNotePost post = getPost(postId);
        validateEnrollment(student, post.getCourse().getCourseId());
        return sharedNoteCommentRepository.findByPostId(postId).stream()
            .map(c -> toCommentResponse(c, student))
            .collect(Collectors.toList());
    }

    @Transactional
    public CommentResponse addComment(Long postId, String content, Student student) {
        SharedNotePost post = getPost(postId);
        validateEnrollment(student, post.getCourse().getCourseId());

        SharedNoteComment comment = new SharedNoteComment();
        comment.setSharedNotePost(post);
        comment.setStudent(student);
        comment.setContent(content);
        return toCommentResponse(sharedNoteCommentRepository.save(comment), student);
    }

    @Transactional
    public CommentResponse updateComment(Long commentId, String content, Student student) {
        SharedNoteComment comment = getOwnedComment(commentId, student, "작성자 본인만 수정할 수 있습니다.");
        comment.setContent(content);
        return toCommentResponse(comment, student);
    }

    @Transactional
    public void deleteComment(Long commentId, Student student) {
        sharedNoteCommentRepository.delete(getOwnedComment(commentId, student, "작성자 본인만 삭제할 수 있습니다."));
    }

    // 같은 강의·학생 노트를 한 번에 조회해 루트부터 BFS로 하위 노트를 모은다(N+1 없음).
    // 방문 집합으로 비정상적인 순환 데이터가 있어도 끝나도록 한다.
    private List<Note> collectSubtree(Note root, Student student) {
        Map<Long, List<Note>> childrenByParentId = noteRepository
            .findByCourseAndStudentOrderByCreatedAtAsc(root.getCourse(), student).stream()
            .filter(n -> n.getParentNote() != null)
            .collect(Collectors.groupingBy(n -> n.getParentNote().getNoteId()));

        List<Note> result = new ArrayList<>();
        Set<Long> visited = new HashSet<>();
        Deque<Note> queue = new ArrayDeque<>(List.of(root));
        while (!queue.isEmpty()) {
            Note note = queue.poll();
            if (!visited.add(note.getNoteId())) continue;
            result.add(note);
            queue.addAll(childrenByParentId.getOrDefault(note.getNoteId(), List.of()));
        }
        return result;
    }

    private static SharedNoteDetailResponse.Node toNode(SharedNoteSnapshot s,
                                                        Map<Long, List<SharedNoteSnapshot>> childrenByParent) {
        return SharedNoteDetailResponse.Node.builder()
            .noteId(s.getOriginalNoteId())
            .title(s.getTitle())
            .content(s.getContent())
            .children(childrenByParent.getOrDefault(s.getOriginalNoteId(), List.of()).stream()
                .map(child -> toNode(child, childrenByParent))
                .collect(Collectors.toList()))
            .build();
    }

    private SharedNoteComment getOwnedComment(Long commentId, Student student, String message) {
        SharedNoteComment comment = sharedNoteCommentRepository.findById(commentId)
            .orElseThrow(() -> new ResourceNotFoundException("댓글을 찾을 수 없습니다."));
        if (!isSameStudent(comment.getStudent(), student)) {
            throw new CourseAccessException(message);
        }
        return comment;
    }

    private static CommentResponse toCommentResponse(SharedNoteComment c, Student viewer) {
        return CommentResponse.builder()
            .commentId(c.getCommentId())
            .content(c.getContent())
            .authorName(PostService.anonymousName(c.getStudent()))
            .author(isSameStudent(c.getStudent(), viewer))
            .createdAt(c.getCreatedAt())
            .build();
    }

    private static boolean isSameStudent(Student a, Student b) {
        return a.getStudId().equals(b.getStudId());
    }

    private SharedNotePost getPost(Long postId) {
        return sharedNotePostRepository.findById(postId)
            .orElseThrow(() -> new ResourceNotFoundException("공유된 노트를 찾을 수 없습니다."));
    }

    private void validateEnrollment(Student student, Long courseId) {
        if (!enrollmentRepository.existsByStudentAndCourse_CourseId(student, courseId)) {
            throw new CourseAccessException("해당 강의를 수강하지 않습니다.");
        }
    }
}
