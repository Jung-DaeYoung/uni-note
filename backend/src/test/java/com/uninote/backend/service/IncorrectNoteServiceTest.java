package com.uninote.backend.service;

import com.uninote.backend.domain.IncorrectNoteGroup;
import com.uninote.backend.domain.Question;
import com.uninote.backend.domain.QuestionType;
import com.uninote.backend.domain.QuizSet;
import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.AddToIncorrectRequest;
import com.uninote.backend.dto.IncorrectSummaryResponse;
import com.uninote.backend.dto.QuestionResponse;
import com.uninote.backend.dto.ReviewPriority;
import com.uninote.backend.dto.TodayReviewQuestionResponse;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.exception.InvalidRequestException;
import com.uninote.backend.exception.ResourceNotFoundException;
import com.uninote.backend.repository.IncorrectNoteGroupRepository;
import com.uninote.backend.repository.IncorrectNoteItemRepository;
import com.uninote.backend.repository.QuestionAnswerStat;
import com.uninote.backend.repository.QuestionRepository;
import com.uninote.backend.repository.UserAnswerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class IncorrectNoteServiceTest {

    private final IncorrectNoteGroupRepository groupRepository = mock(IncorrectNoteGroupRepository.class);
    private final IncorrectNoteItemRepository itemRepository = mock(IncorrectNoteItemRepository.class);
    private final QuestionRepository questionRepository = mock(QuestionRepository.class);
    private final UserAnswerRepository userAnswerRepository = mock(UserAnswerRepository.class);
    private final QuestionResponseMapper questionResponseMapper = mock(QuestionResponseMapper.class);

    private final IncorrectNoteService incorrectNoteService = new IncorrectNoteService(
            groupRepository, itemRepository, questionRepository, userAnswerRepository, questionResponseMapper);

    private Student owner;
    private Student other;
    private IncorrectNoteGroup group;
    private QuizSet ownedQuizSet;
    private Question question;

    @BeforeEach
    void setUp() {
        owner = new Student();
        owner.setStudId(1L);
        owner.setStudentNum("owner-num");

        other = new Student();
        other.setStudId(2L);
        other.setStudentNum("other-num");

        group = new IncorrectNoteGroup();
        group.setId(30L);
        group.setStudent(owner);
        group.setTitle("오답노트");
        group.setItems(Collections.emptyList());

        ownedQuizSet = new QuizSet();
        ownedQuizSet.setQuizSetId(50L);
        ownedQuizSet.setStudent(owner);

        question = new Question();
        question.setQuestionId(40L);
        question.setQuizSet(ownedQuizSet);
    }

    // 문제별 집계 쿼리(QuestionAnswerStat)의 mock 값을 손쉽게 만들기 위한 헬퍼.
    private QuestionAnswerStat rawStat(Long questionId, Long courseId, String courseName, QuestionType type,
                                        long attemptCount, long correctCount, long incorrectCount,
                                        LocalDateTime lastAttemptedAt, LocalDateTime lastIncorrectAt) {
        return new QuestionAnswerStat() {
            public Long getQuestionId() { return questionId; }
            public Long getCourseId() { return courseId; }
            public String getCourseName() { return courseName; }
            public QuestionType getType() { return type; }
            public Long getAttemptCount() { return attemptCount; }
            public Long getCorrectCount() { return correctCount; }
            public Long getIncorrectCount() { return incorrectCount; }
            public LocalDateTime getLastAttemptedAt() { return lastAttemptedAt; }
            public LocalDateTime getLastIncorrectAt() { return lastIncorrectAt; }
        };
    }

    @Test
    void ownerCanAddQuestionToOwnGroup() {
        when(groupRepository.findById(30L)).thenReturn(Optional.of(group));
        when(questionRepository.findById(40L)).thenReturn(Optional.of(question));
        when(itemRepository.findByGroup_IdAndQuestion_QuestionId(30L, 40L)).thenReturn(Optional.empty());

        AddToIncorrectRequest request = new AddToIncorrectRequest();
        request.setGroupId(30L);
        request.setQuestionId(40L);

        incorrectNoteService.addToGroup(request, owner);

        verify(itemRepository).save(any());
    }

    @Test
    void addToGroupThrowsResourceNotFoundWhenGroupDoesNotExist() {
        when(groupRepository.findById(999L)).thenReturn(Optional.empty());

        AddToIncorrectRequest request = new AddToIncorrectRequest();
        request.setGroupId(999L);
        request.setQuestionId(40L);

        assertThatThrownBy(() -> incorrectNoteService.addToGroup(request, owner))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void addToGroupThrowsInvalidRequestWhenNeitherGroupIdNorNewTitleProvided() {
        AddToIncorrectRequest request = new AddToIncorrectRequest();
        request.setQuestionId(40L);

        assertThatThrownBy(() -> incorrectNoteService.addToGroup(request, owner))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void otherStudentCannotAddQuestionToSomeoneElsesGroup() {
        when(groupRepository.findById(30L)).thenReturn(Optional.of(group));

        AddToIncorrectRequest request = new AddToIncorrectRequest();
        request.setGroupId(30L);
        request.setQuestionId(40L);

        assertThatThrownBy(() -> incorrectNoteService.addToGroup(request, other))
                .isInstanceOf(CourseAccessException.class);

        verify(itemRepository, never()).save(any());
    }

    @Test
    void questionFromAnotherStudentsQuizCannotBeAddedEvenToOwnGroup() {
        QuizSet foreignQuizSet = new QuizSet();
        foreignQuizSet.setQuizSetId(60L);
        foreignQuizSet.setStudent(other);
        question.setQuizSet(foreignQuizSet);

        when(groupRepository.findById(30L)).thenReturn(Optional.of(group));
        when(questionRepository.findById(40L)).thenReturn(Optional.of(question));

        AddToIncorrectRequest request = new AddToIncorrectRequest();
        request.setGroupId(30L);
        request.setQuestionId(40L);

        assertThatThrownBy(() -> incorrectNoteService.addToGroup(request, owner))
                .isInstanceOf(CourseAccessException.class);

        verify(itemRepository, never()).save(any());
    }

    @Test
    void ownerCanDeleteOwnGroup() {
        when(groupRepository.findById(30L)).thenReturn(Optional.of(group));

        incorrectNoteService.deleteGroup(30L, owner);

        verify(groupRepository).delete(group);
    }

    @Test
    void otherStudentCannotDeleteSomeoneElsesGroup() {
        when(groupRepository.findById(30L)).thenReturn(Optional.of(group));

        assertThatThrownBy(() -> incorrectNoteService.deleteGroup(30L, other))
                .isInstanceOf(CourseAccessException.class);

        verify(groupRepository, never()).delete(any(IncorrectNoteGroup.class));
    }

    @Test
    void otherStudentCannotRemoveItemFromSomeoneElsesGroup() {
        when(groupRepository.findById(30L)).thenReturn(Optional.of(group));

        assertThatThrownBy(() -> incorrectNoteService.removeItemFromGroup(30L, 40L, other))
                .isInstanceOf(CourseAccessException.class);

        verify(itemRepository, never()).delete(any());
    }

    @Test
    void ownerCanGetOwnPracticeSession() {
        when(groupRepository.findById(30L)).thenReturn(Optional.of(group));

        var response = incorrectNoteService.getPracticeSession(30L, owner);

        assertThat(response.getTitle()).contains("오답노트");
    }

    @Test
    void otherStudentCannotGetSomeoneElsesPracticeSession() {
        when(groupRepository.findById(30L)).thenReturn(Optional.of(group));

        assertThatThrownBy(() -> incorrectNoteService.getPracticeSession(30L, other))
                .isInstanceOf(CourseAccessException.class);
    }

    @Test
    void getSummaryReturnsAllZerosWhenNoAnswerHistory() {
        when(userAnswerRepository.aggregateByQuestionForStudent(owner.getStudId())).thenReturn(List.of());

        IncorrectSummaryResponse summary = incorrectNoteService.getSummary(owner);

        assertThat(summary.getTotalAttemptCount()).isZero();
        assertThat(summary.getTotalQuestionCount()).isZero();
        assertThat(summary.getAccuracyRate()).isZero();
        assertThat(summary.getReviewTargetCount()).isZero();
        assertThat(summary.getRepeatIncorrectCount()).isZero();
    }

    @Test
    void getSummaryComputesCorrectIncorrectAndAccuracy() {
        LocalDateTime recent = LocalDateTime.of(2024, 1, 10, 12, 0);
        LocalDateTime older = recent.minusDays(3);

        // q40: 4번 풀이, 3정답 1오답. 최근 풀이(recent)는 정답이었으므로 recentlyIncorrect=false → LOW.
        // q41: 2번 풀이, 0정답 2오답(반복 오답) → HIGH.
        when(userAnswerRepository.aggregateByQuestionForStudent(owner.getStudId())).thenReturn(List.of(
                rawStat(40L, null, null, QuestionType.SHORT_ANSWER, 4, 3, 1, recent, older),
                rawStat(41L, null, null, QuestionType.SHORT_ANSWER, 2, 0, 2, recent, recent)
        ));
        when(questionRepository.findAllById(any())).thenReturn(List.of(question, questionWithId(41L)));

        IncorrectSummaryResponse summary = incorrectNoteService.getSummary(owner);

        assertThat(summary.getTotalAttemptCount()).isEqualTo(6);
        assertThat(summary.getTotalQuestionCount()).isEqualTo(2);
        assertThat(summary.getCorrectCount()).isEqualTo(3);
        assertThat(summary.getIncorrectCount()).isEqualTo(3);
        assertThat(summary.getAccuracyRate()).isEqualTo(0.5);
        assertThat(summary.getRepeatIncorrectCount()).isEqualTo(1);
        assertThat(summary.getReviewTargetCount()).isEqualTo(1);
    }

    @Test
    void getTodayReviewOrdersByIncorrectCountThenRecentIncorrectThenLastAttemptedThenQuestionId() {
        LocalDateTime now = LocalDateTime.of(2024, 1, 10, 12, 0);
        LocalDateTime recentIshButNotIncorrect = now.minusDays(2);
        LocalDateTime old = now.minusDays(10);

        // A(q1): 반복 오답 수가 가장 많아 다른 모든 기준보다 우선한다.
        // B(q2): 나머지와 오답 수는 같지만(2) 가장 최근 풀이가 오답이라 우선한다.
        // C(q3): 최근에 풀었지만 그 풀이는 정답이었다(recentlyIncorrect=false).
        // D(q999)/E(q10): C보다 오래전에 마지막으로 풀어(더 오래 복습 안 함) C보다 우선하고,
        //                 D와 E는 마지막 풀이 시각까지 같아 questionId가 작은 E가 먼저 온다.
        when(userAnswerRepository.aggregateByQuestionForStudent(owner.getStudId())).thenReturn(List.of(
                rawStat(1L, null, null, QuestionType.SHORT_ANSWER, 5, 0, 5, now, now),
                rawStat(2L, null, null, QuestionType.SHORT_ANSWER, 2, 0, 2, now, now),
                rawStat(3L, null, null, QuestionType.SHORT_ANSWER, 2, 0, 2, recentIshButNotIncorrect, recentIshButNotIncorrect.minusDays(5)),
                rawStat(999L, null, null, QuestionType.SHORT_ANSWER, 2, 0, 2, old, old.minusDays(5)),
                rawStat(10L, null, null, QuestionType.SHORT_ANSWER, 2, 0, 2, old, old.minusDays(5))
        ));
        when(questionRepository.findAllById(any())).thenReturn(List.of(
                questionWithId(1L), questionWithId(2L), questionWithId(3L), questionWithId(999L), questionWithId(10L)));
        stubQuestionResponseMapperToEchoQuestionId();

        List<TodayReviewQuestionResponse> result = incorrectNoteService.getTodayReview(owner, 10, null);

        assertThat(result).extracting(r -> r.getQuestion().getQuestionId())
                .containsExactly(1L, 2L, 10L, 999L, 3L);
    }

    @Test
    void getTodayReviewAppliesLimit() {
        when(userAnswerRepository.aggregateByQuestionForStudent(owner.getStudId())).thenReturn(List.of(
                rawStat(1L, null, null, QuestionType.SHORT_ANSWER, 2, 0, 2, LocalDateTime.now(), LocalDateTime.now()),
                rawStat(2L, null, null, QuestionType.SHORT_ANSWER, 2, 0, 2, LocalDateTime.now(), LocalDateTime.now()),
                rawStat(3L, null, null, QuestionType.SHORT_ANSWER, 2, 0, 2, LocalDateTime.now(), LocalDateTime.now())
        ));
        when(questionRepository.findAllById(any())).thenReturn(List.of(
                questionWithId(1L), questionWithId(2L), questionWithId(3L)));

        List<TodayReviewQuestionResponse> result = incorrectNoteService.getTodayReview(owner, 2, null);

        assertThat(result).hasSize(2);
    }

    @Test
    void getTodayReviewFiltersByCourseId() {
        LocalDateTime now = LocalDateTime.now();
        when(userAnswerRepository.aggregateByQuestionForStudent(owner.getStudId())).thenReturn(List.of(
                rawStat(1L, 100L, "강의A", QuestionType.SHORT_ANSWER, 2, 0, 2, now, now),
                rawStat(2L, 200L, "강의B", QuestionType.SHORT_ANSWER, 2, 0, 2, now, now)
        ));
        when(questionRepository.findAllById(any())).thenReturn(List.of(questionWithId(1L), questionWithId(2L)));

        List<TodayReviewQuestionResponse> result = incorrectNoteService.getTodayReview(owner, 10, 100L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getCourseId()).isEqualTo(100L);
    }

    @Test
    void getTodayReviewRejectsNonPositiveLimit() {
        assertThatThrownBy(() -> incorrectNoteService.getTodayReview(owner, 0, null))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void getTodayReviewReturnsEmptyListWhenNoReviewTargets() {
        LocalDateTime old = LocalDateTime.now().minusDays(30);
        // 정답률 100%, 반복 오답 없음, 최근 풀이도 정답 → LOW 등급이라 복습 대상에서 제외된다.
        when(userAnswerRepository.aggregateByQuestionForStudent(owner.getStudId())).thenReturn(List.of(
                rawStat(40L, null, null, QuestionType.SHORT_ANSWER, 5, 5, 0, old, null)
        ));
        when(questionRepository.findAllById(any())).thenReturn(List.of(question));

        List<TodayReviewQuestionResponse> result = incorrectNoteService.getTodayReview(owner, 10, null);

        assertThat(result).isEmpty();
    }

    private Question questionWithId(Long id) {
        Question q = new Question();
        q.setQuestionId(id);
        return q;
    }

    private void stubQuestionResponseMapperToEchoQuestionId() {
        when(questionResponseMapper.toResponse(any())).thenAnswer(invocation -> {
            Question q = invocation.getArgument(0);
            QuestionResponse response = new QuestionResponse();
            response.setQuestionId(q.getQuestionId());
            return response;
        });
    }
}
