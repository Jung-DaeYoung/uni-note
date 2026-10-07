package com.uninote.backend.service;

import com.uninote.backend.domain.*;
import com.uninote.backend.dto.CommentResponse;
import com.uninote.backend.dto.SharedNoteDetailResponse;
import com.uninote.backend.dto.SharedNoteResponse;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.exception.InvalidRequestException;
import com.uninote.backend.exception.ResourceNotFoundException;
import com.uninote.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class SharedNoteServiceTest {

    private final SharedNotePostRepository sharedNotePostRepository = mock(SharedNotePostRepository.class);
    private final SharedNoteCommentRepository sharedNoteCommentRepository = mock(SharedNoteCommentRepository.class);
    private final NoteRepository noteRepository = mock(NoteRepository.class);
    private final EnrollmentRepository enrollmentRepository = mock(EnrollmentRepository.class);

    private final SharedNoteService sharedNoteService = new SharedNoteService(
            sharedNotePostRepository, sharedNoteCommentRepository, noteRepository, enrollmentRepository);

    private Student author;
    private Student reader;
    private Student outsider;
    private Course course;
    private Note root;
    private Note child;
    private Note grandChild;
    private Note unrelated;

    @BeforeEach
    void setUp() {
        author = student(1L);
        reader = student(2L);
        outsider = student(3L);

        course = new Course();
        course.setCourseId(10L);
        course.setCourseName("운영체제");

        root = note(100L, "루트", null);
        child = note(101L, "자식", root);
        grandChild = note(102L, "손자", child);
        unrelated = note(200L, "다른 루트", null);

        when(enrollmentRepository.existsByStudentAndCourse_CourseId(any(), eq(10L))).thenReturn(true);
        when(enrollmentRepository.existsByStudentAndCourse_CourseId(outsider, 10L)).thenReturn(false);
        when(noteRepository.findById(100L)).thenReturn(Optional.of(root));
        when(noteRepository.findByCourseAndStudentOrderByCreatedAtAsc(course, author))
                .thenReturn(List.of(root, child, grandChild, unrelated));
    }

    @Test
    void shareCopiesRootAndAllDescendantsOnly() {
        sharedNoteService.share(100L, author);

        SharedNotePost saved = capturedPost();
        assertThat(saved.getSourceRootNoteId()).isEqualTo(100L);
        assertThat(saved.getTitle()).isEqualTo("루트");
        assertThat(saved.getStudent()).isSameAs(author);
        assertThat(saved.getCourse()).isSameAs(course);
        assertThat(saved.getSnapshots())
                .extracting(SharedNoteSnapshot::getOriginalNoteId, SharedNoteSnapshot::getParentOriginalNoteId)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(100L, null),
                        org.assertj.core.groups.Tuple.tuple(101L, 100L),
                        org.assertj.core.groups.Tuple.tuple(102L, 101L));
        assertThat(saved.getSnapshots()).allSatisfy(s -> assertThat(s.getSharedNotePost()).isSameAs(saved));
    }

    @Test
    void shareRejectsSomeoneElsesNote() {
        assertThatThrownBy(() -> sharedNoteService.share(100L, reader))
                .isInstanceOf(CourseAccessException.class);
        verify(sharedNotePostRepository, never()).save(any());
    }

    @Test
    void shareRejectsWhenNotEnrolled() {
        root.setStudent(outsider);

        assertThatThrownBy(() -> sharedNoteService.share(100L, outsider))
                .isInstanceOf(CourseAccessException.class);
        verify(sharedNotePostRepository, never()).save(any());
    }

    @Test
    void shareRejectsAlreadySharedNote() {
        when(sharedNotePostRepository.existsBySourceRootNoteId(100L)).thenReturn(true);

        assertThatThrownBy(() -> sharedNoteService.share(100L, author))
                .isInstanceOf(InvalidRequestException.class);
        verify(sharedNotePostRepository, never()).save(any());
    }

    @Test
    void detailIsSnapshotTreeUnaffectedByLaterOriginalEdits() {
        sharedNoteService.share(100L, author);
        SharedNotePost saved = capturedPost();
        saved.setSharedNotePostId(70L);
        when(sharedNotePostRepository.findById(70L)).thenReturn(Optional.of(saved));

        root.setTitle("수정된 루트");
        root.setContent("{\"changed\":true}");

        SharedNoteDetailResponse detail = sharedNoteService.getDetail(70L, reader);

        assertThat(detail.isAuthor()).isFalse();
        assertThat(detail.getNotes()).singleElement().satisfies(r -> {
            assertThat(r.getNoteId()).isEqualTo(100L);
            assertThat(r.getTitle()).isEqualTo("루트");
            assertThat(r.getContent()).isEqualTo("content-100");
            assertThat(r.getChildren()).singleElement().satisfies(c -> {
                assertThat(c.getNoteId()).isEqualTo(101L);
                assertThat(c.getChildren()).singleElement()
                        .satisfies(g -> assertThat(g.getNoteId()).isEqualTo(102L));
            });
        });
    }

    @Test
    void detailRejectsNonEnrolledStudent() {
        when(sharedNotePostRepository.findById(70L)).thenReturn(Optional.of(post()));

        assertThatThrownBy(() -> sharedNoteService.getDetail(70L, outsider))
                .isInstanceOf(CourseAccessException.class);
    }

    @Test
    void detailOfDeletedPostIsNotFound() {
        when(sharedNotePostRepository.findById(70L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> sharedNoteService.getDetail(70L, reader))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> sharedNoteService.getComments(70L, reader))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void listMarksAuthor() {
        Enrollment enrollment = new Enrollment();
        enrollment.setCourse(course);
        when(enrollmentRepository.findByStudent(author)).thenReturn(List.of(enrollment));
        when(sharedNotePostRepository.findByCourseIds(List.of(10L))).thenReturn(List.of(post()));

        List<SharedNoteResponse> result = sharedNoteService.getSharedNotes(author, null);

        assertThat(result).singleElement().satisfies(r -> {
            assertThat(r.getSharedNotePostId()).isEqualTo(70L);
            assertThat(r.getCourseName()).isEqualTo("운영체제");
            assertThat(r.isAuthor()).isTrue();
        });
    }

    @Test
    void onlyAuthorCanDeletePost() {
        SharedNotePost post = post();
        when(sharedNotePostRepository.findById(70L)).thenReturn(Optional.of(post));

        assertThatThrownBy(() -> sharedNoteService.deletePost(70L, reader))
                .isInstanceOf(CourseAccessException.class);
        verify(sharedNotePostRepository, never()).delete(any());

        sharedNoteService.deletePost(70L, author);
        verify(sharedNotePostRepository).delete(post);
    }

    @Test
    void enrolledStudentCanComment() {
        when(sharedNotePostRepository.findById(70L)).thenReturn(Optional.of(post()));
        when(sharedNoteCommentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CommentResponse response = sharedNoteService.addComment(70L, "좋은 정리네요", reader);

        assertThat(response.getContent()).isEqualTo("좋은 정리네요");
        assertThat(response.isAuthor()).isTrue();
    }

    @Test
    void nonEnrolledStudentCannotComment() {
        when(sharedNotePostRepository.findById(70L)).thenReturn(Optional.of(post()));

        assertThatThrownBy(() -> sharedNoteService.addComment(70L, "댓글", outsider))
                .isInstanceOf(CourseAccessException.class);
        verify(sharedNoteCommentRepository, never()).save(any());
    }

    @Test
    void onlyCommentAuthorCanUpdateOrDelete() {
        SharedNoteComment comment = new SharedNoteComment();
        comment.setCommentId(5L);
        comment.setStudent(reader);
        comment.setContent("원래 댓글");
        when(sharedNoteCommentRepository.findById(5L)).thenReturn(Optional.of(comment));

        // 게시글 작성자라도 남의 댓글은 지울 수 없다.
        assertThatThrownBy(() -> sharedNoteService.deleteComment(5L, author))
                .isInstanceOf(CourseAccessException.class);
        assertThatThrownBy(() -> sharedNoteService.updateComment(5L, "수정", author))
                .isInstanceOf(CourseAccessException.class);

        assertThat(sharedNoteService.updateComment(5L, "수정", reader).getContent()).isEqualTo("수정");
        sharedNoteService.deleteComment(5L, reader);
        verify(sharedNoteCommentRepository).delete(comment);
    }

    @Test
    void missingCommentIsNotFound() {
        when(sharedNoteCommentRepository.findById(5L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> sharedNoteService.deleteComment(5L, reader))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    private SharedNotePost capturedPost() {
        ArgumentCaptor<SharedNotePost> captor = ArgumentCaptor.forClass(SharedNotePost.class);
        verify(sharedNotePostRepository).save(captor.capture());
        return captor.getValue();
    }

    private SharedNotePost post() {
        SharedNotePost post = new SharedNotePost();
        post.setSharedNotePostId(70L);
        post.setStudent(author);
        post.setCourse(course);
        post.setSourceRootNoteId(100L);
        post.setTitle("루트");
        return post;
    }

    private Note note(Long id, String title, Note parent) {
        Note note = new Note();
        note.setNoteId(id);
        note.setTitle(title);
        note.setContent("content-" + id);
        note.setCourse(course);
        note.setStudent(author);
        note.setParentNote(parent);
        return note;
    }

    private static Student student(Long id) {
        Student s = new Student();
        s.setStudId(id);
        return s;
    }
}
