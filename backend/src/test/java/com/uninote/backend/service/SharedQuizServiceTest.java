package com.uninote.backend.service;

import com.uninote.backend.domain.*;
import com.uninote.backend.dto.CommentResponse;
import com.uninote.backend.dto.SharedQuizLikeResponse;
import com.uninote.backend.dto.SharedQuizResponse;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.exception.InvalidRequestException;
import com.uninote.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Sort;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class SharedQuizServiceTest {

    private final SharedQuizRepository sharedQuizRepository = mock(SharedQuizRepository.class);
    private final SharedQuizLikeRepository sharedQuizLikeRepository = mock(SharedQuizLikeRepository.class);
    private final QuizSetRepository quizSetRepository = mock(QuizSetRepository.class);
    private final QuestionRepository questionRepository = mock(QuestionRepository.class);
    private final EnrollmentRepository enrollmentRepository = mock(EnrollmentRepository.class);
    private final UserAnswerRepository userAnswerRepository = mock(UserAnswerRepository.class);
    private final IncorrectNoteItemRepository incorrectNoteItemRepository = mock(IncorrectNoteItemRepository.class);
    private final QuestionResponseMapper questionResponseMapper = mock(QuestionResponseMapper.class);
    private final SharedQuizCommentRepository sharedQuizCommentRepository = mock(SharedQuizCommentRepository.class);

    private final SharedQuizService sharedQuizService = new SharedQuizService(
            sharedQuizRepository, sharedQuizLikeRepository, quizSetRepository, questionRepository,
            enrollmentRepository, userAnswerRepository, incorrectNoteItemRepository, questionResponseMapper,
            sharedQuizCommentRepository);

    private Student author;
    private Student reader;
    private Course course;
    private QuizSet origin;
    private QuizSet snapshot;
    private SharedQuiz post;

    @BeforeEach
    void setUp() {
        author = new Student();
        author.setStudId(1L);
        reader = new Student();
        reader.setStudId(2L);

        course = new Course();
        course.setCourseId(10L);
        course.setCourseName("운영체제");

        origin = new QuizSet();
        origin.setQuizSetId(50L);
        origin.setStudent(author);
        origin.setCourse(course);
        origin.setTitle("페이지 교체");
        Question q = new Question();
        q.setQuestionId(5L);
        q.setQuizSet(origin);
        q.setType(QuestionType.MULTIPLE_CHOICE);
        q.setQuestionText("LRU는?");
        q.setCorrectAnswer("A");
        q.setSourceNoteId(100L);
        q.setSourceBlockId("b1");
        origin.setQuestions(new ArrayList<>(List.of(q)));

        snapshot = new QuizSet();
        snapshot.setQuizSetId(60L);
        snapshot.setCourse(course);
        snapshot.setTitle("페이지 교체");

        post = new SharedQuiz();
        post.setSharedQuizId(70L);
        post.setQuizSet(snapshot);
        post.setStudent(author);
        post.setCourse(course);
        post.setSourceQuizSetId(50L);

        when(enrollmentRepository.existsByStudentAndCourse_CourseId(any(), eq(10L))).thenReturn(true);
        when(sharedQuizRepository.findById(70L)).thenReturn(Optional.of(post));
    }

    @Test
    void shareCopiesQuizAsOwnerlessSnapshotWithoutSource() {
        when(quizSetRepository.findById(50L)).thenReturn(Optional.of(origin));
        when(quizSetRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        sharedQuizService.share(50L, author);

        ArgumentCaptor<SharedQuiz> captor = ArgumentCaptor.forClass(SharedQuiz.class);
        verify(sharedQuizRepository).save(captor.capture());
        SharedQuiz saved = captor.getValue();
        assertThat(saved.getSourceQuizSetId()).isEqualTo(50L);
        assertThat(saved.getStudent()).isSameAs(author);
        QuizSet copy = saved.getQuizSet();
        assertThat(copy).isNotSameAs(origin);
        assertThat(copy.getStudent()).isNull();
        assertThat(copy.getQuestions()).singleElement().satisfies(c -> {
            assertThat(c.getQuestionText()).isEqualTo("LRU는?");
            assertThat(c.getSourceNoteId()).isNull();
            assertThat(c.getSourceBlockId()).isNull();
            assertThat(c.getQuizSet()).isSameAs(copy);
        });
    }

    @Test
    void shareRejectsSomeoneElsesQuiz() {
        when(quizSetRepository.findById(50L)).thenReturn(Optional.of(origin));

        assertThatThrownBy(() -> sharedQuizService.share(50L, reader))
                .isInstanceOf(CourseAccessException.class);
        verify(sharedQuizRepository, never()).save(any());
    }

    @Test
    void shareRejectsQuizOfUserCreatedCourse() {
        course.setUserCreated(true);
        when(quizSetRepository.findById(50L)).thenReturn(Optional.of(origin));

        assertThatThrownBy(() -> sharedQuizService.share(50L, author))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("직접 만든 강의");
        verify(sharedQuizRepository, never()).save(any());
    }

    @Test
    void shareRejectsAlreadySharedQuiz() {
        when(quizSetRepository.findById(50L)).thenReturn(Optional.of(origin));
        when(sharedQuizRepository.existsBySourceQuizSetId(50L)).thenReturn(true);

        assertThatThrownBy(() -> sharedQuizService.share(50L, author))
                .isInstanceOf(InvalidRequestException.class);
        verify(sharedQuizRepository, never()).save(any());
    }

    @Test
    void listUsesRequestedSortAndMarksLikedAndAuthor() {
        Enrollment enrollment = new Enrollment();
        enrollment.setCourse(course);
        when(enrollmentRepository.findByStudent(reader)).thenReturn(List.of(enrollment));
        when(sharedQuizRepository.findByCourseIds(eq(List.of(10L)), any(Sort.class))).thenReturn(List.of(post));
        when(sharedQuizLikeRepository.findLikedSharedQuizIds(eq(2L), anyList())).thenReturn(Set.of(70L));

        List<SharedQuizResponse> result = sharedQuizService.getSharedQuizzes(reader, "likes", null);

        ArgumentCaptor<Sort> sortCaptor = ArgumentCaptor.forClass(Sort.class);
        verify(sharedQuizRepository).findByCourseIds(eq(List.of(10L)), sortCaptor.capture());
        assertThat(sortCaptor.getValue()).containsExactly(
                Sort.Order.desc("likeCount"), Sort.Order.desc("createdAt"));
        assertThat(result).singleElement().satisfies(r -> {
            assertThat(r.getQuizSetId()).isEqualTo(60L);
            assertThat(r.isLiked()).isTrue();
            assertThat(r.isAuthor()).isFalse();
            assertThat(r.getAuthorName()).isEqualTo("익명 1");
        });
    }

    @Test
    void listRejectsUnknownSort() {
        assertThatThrownBy(() -> sharedQuizService.getSharedQuizzes(reader, "random", null))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void nonEnrolledStudentCannotOpenOrFilterBoard() {
        when(enrollmentRepository.existsByStudentAndCourse_CourseId(reader, 10L)).thenReturn(false);

        assertThatThrownBy(() -> sharedQuizService.getDetail(70L, reader))
                .isInstanceOf(CourseAccessException.class);
        assertThatThrownBy(() -> sharedQuizService.getSharedQuizzes(reader, "latest", 10L))
                .isInstanceOf(CourseAccessException.class);
        verify(sharedQuizRepository, never()).incrementViewCount(any());
    }

    @Test
    void openingDetailIncrementsViewCount() {
        sharedQuizService.getDetail(70L, reader);

        verify(sharedQuizRepository).incrementViewCount(70L);
    }

    @Test
    void toggleLikeAddsThenRemoves() {
        when(sharedQuizLikeRepository.findBySharedQuiz_SharedQuizIdAndStudent_StudId(70L, 2L))
                .thenReturn(Optional.empty());
        when(sharedQuizLikeRepository.countBySharedQuiz_SharedQuizId(70L)).thenReturn(1L);

        SharedQuizLikeResponse on = sharedQuizService.toggleLike(70L, reader);

        assertThat(on.isLiked()).isTrue();
        assertThat(on.getLikeCount()).isEqualTo(1L);
        verify(sharedQuizRepository).addLikeCount(70L, 1);

        SharedQuizLike existing = new SharedQuizLike();
        when(sharedQuizLikeRepository.findBySharedQuiz_SharedQuizIdAndStudent_StudId(70L, 2L))
                .thenReturn(Optional.of(existing));
        when(sharedQuizLikeRepository.countBySharedQuiz_SharedQuizId(70L)).thenReturn(0L);

        SharedQuizLikeResponse off = sharedQuizService.toggleLike(70L, reader);

        assertThat(off.isLiked()).isFalse();
        verify(sharedQuizLikeRepository).delete(existing);
        verify(sharedQuizRepository).addLikeCount(70L, -1);
    }

    @Test
    void onlyAuthorCanDeletePostAndSnapshotIsKept() {
        assertThatThrownBy(() -> sharedQuizService.deletePost(70L, reader))
                .isInstanceOf(CourseAccessException.class);

        sharedQuizService.deletePost(70L, author);

        verify(sharedQuizRepository).delete(post);
        verify(quizSetRepository, never()).delete(any());
    }

    @Test
    void questionStaysAccessibleAfterPostDeletionWhenInIncorrectNote() {
        Question copied = new Question();
        copied.setQuestionId(6L);
        copied.setQuizSet(snapshot);
        // 글 삭제 후: 더 이상 게시 중이 아님
        when(sharedQuizRepository.existsByQuizSet_QuizSetId(60L)).thenReturn(false);

        assertThat(sharedQuizService.canAccessQuestion(copied, reader)).isFalse();

        when(incorrectNoteItemRepository.existsByGroup_Student_StudIdAndQuestion_QuestionId(2L, 6L)).thenReturn(true);
        assertThat(sharedQuizService.canAccessQuestion(copied, reader)).isTrue();
    }

    @Test
    void postedSnapshotIsSolvableOnlyByEnrolledStudents() {
        when(sharedQuizRepository.existsByQuizSet_QuizSetId(60L)).thenReturn(true);
        assertThat(sharedQuizService.canSolve(snapshot, reader)).isTrue();

        when(enrollmentRepository.existsByStudentAndCourse_CourseId(reader, 10L)).thenReturn(false);
        assertThat(sharedQuizService.canSolve(snapshot, reader)).isFalse();
    }

    // ---- 문제별 댓글 ----

    private Question snapshotQuestion(long id) {
        Question q = new Question();
        q.setQuestionId(id);
        q.setQuizSet(snapshot);
        snapshot.getQuestions().add(q);
        return q;
    }

    private SharedQuizComment commentBy(Student author, Question q, long id, String content) {
        SharedQuizComment c = new SharedQuizComment();
        c.setCommentId(id);
        c.setSharedQuiz(post);
        c.setQuestion(q);
        c.setStudent(author);
        c.setContent(content);
        return c;
    }

    @Test
    void enrolledStudentCanCommentOnQuestionOfThePost() {
        Question q = snapshotQuestion(61L);
        when(sharedQuizCommentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CommentResponse res = sharedQuizService.addComment(70L, 61L, "왜 답이 A인가요?", reader);

        ArgumentCaptor<SharedQuizComment> captor = ArgumentCaptor.forClass(SharedQuizComment.class);
        verify(sharedQuizCommentRepository).save(captor.capture());
        assertThat(captor.getValue().getQuestion()).isSameAs(q);
        assertThat(captor.getValue().getSharedQuiz()).isSameAs(post);
        assertThat(res.getContent()).isEqualTo("왜 답이 A인가요?");
        assertThat(res.isAuthor()).isTrue();
        assertThat(res.getAuthorName()).isEqualTo("익명 2");
    }

    @Test
    void commentOnQuestionOutsideThePostIsRejected() {
        snapshotQuestion(61L);

        assertThatThrownBy(() -> sharedQuizService.addComment(70L, 999L, "내용", reader))
                .isInstanceOf(InvalidRequestException.class);
        verify(sharedQuizCommentRepository, never()).save(any());
    }

    @Test
    void nonEnrolledStudentCannotReadOrWriteComments() {
        snapshotQuestion(61L);
        when(enrollmentRepository.existsByStudentAndCourse_CourseId(reader, 10L)).thenReturn(false);

        assertThatThrownBy(() -> sharedQuizService.addComment(70L, 61L, "내용", reader))
                .isInstanceOf(CourseAccessException.class);
        assertThatThrownBy(() -> sharedQuizService.getComments(70L, reader))
                .isInstanceOf(CourseAccessException.class);
    }

    @Test
    void onlyCommentAuthorCanUpdateOrDelete() {
        SharedQuizComment comment = commentBy(reader, snapshotQuestion(61L), 5L, "원래");
        when(sharedQuizCommentRepository.findById(5L)).thenReturn(Optional.of(comment));

        assertThatThrownBy(() -> sharedQuizService.updateComment(5L, "수정", author))
                .isInstanceOf(CourseAccessException.class);
        assertThatThrownBy(() -> sharedQuizService.deleteComment(5L, author))
                .isInstanceOf(CourseAccessException.class);
        verify(sharedQuizCommentRepository, never()).delete(any());

        assertThat(sharedQuizService.updateComment(5L, "수정", reader).getContent()).isEqualTo("수정");
        sharedQuizService.deleteComment(5L, reader);
        verify(sharedQuizCommentRepository).delete(comment);
    }

    @Test
    void commentsAreGroupedByQuestion() {
        Question q1 = snapshotQuestion(61L);
        Question q2 = snapshotQuestion(62L);
        when(sharedQuizCommentRepository.findBySharedQuizId(70L)).thenReturn(List.of(
                commentBy(reader, q1, 1L, "a"), commentBy(author, q2, 2L, "b"), commentBy(author, q1, 3L, "c")));

        var grouped = sharedQuizService.getComments(70L, reader);

        assertThat(grouped.get(61L)).extracting(CommentResponse::getContent).containsExactly("a", "c");
        assertThat(grouped.get(62L)).extracting(CommentResponse::isAuthor).containsExactly(false);
    }
}
