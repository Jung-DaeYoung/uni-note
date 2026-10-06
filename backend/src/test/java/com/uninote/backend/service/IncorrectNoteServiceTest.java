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
import com.uninote.backend.dto.SourceBlockStatResponse;
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

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
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

    private final SharedQuizService sharedQuizService = mock(SharedQuizService.class);
    // 간격 반복 일정 계산의 "오늘"을 2024-01-12로 고정한다.
    private static final ZoneId ZONE = ZoneId.of("Asia/Seoul");
    private final Clock clock = Clock.fixed(LocalDate.of(2024, 1, 12).atTime(12, 0).atZone(ZONE).toInstant(), ZONE);

    private final IncorrectNoteService incorrectNoteService = new IncorrectNoteService(
            groupRepository, itemRepository, questionRepository, userAnswerRepository, questionResponseMapper,
            sharedQuizService, clock);

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
    void accessibleSharedQuestionCanBeAddedToOwnGroup() {
        QuizSet snapshot = new QuizSet(); // 공유 스냅샷은 소유자가 없다
        snapshot.setQuizSetId(60L);
        question.setQuizSet(snapshot);

        when(groupRepository.findById(30L)).thenReturn(Optional.of(group));
        when(questionRepository.findById(40L)).thenReturn(Optional.of(question));
        when(sharedQuizService.canAccessQuestion(question, owner)).thenReturn(true);
        when(itemRepository.findByGroup_IdAndQuestion_QuestionId(30L, 40L)).thenReturn(Optional.empty());

        AddToIncorrectRequest request = new AddToIncorrectRequest();
        request.setGroupId(30L);
        request.setQuestionId(40L);

        incorrectNoteService.addToGroup(request, owner);

        verify(itemRepository).save(any());
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
        // q40은 오답 1회 뒤 연속 3회 정답 → 다음 복습은 마지막 풀이 + 14일이라 아직 아니다. q41은 연속 오답 → 복습 대상.
        when(userAnswerRepository.findAnswerHistoryForStudent(owner.getStudId())).thenReturn(history(
                40L, false, 40L, true, 40L, true, 40L, true, 41L, false, 41L, false));

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
                rawStat(1L, null, null, QuestionType.SHORT_ANSWER, 2, 0, 2, YESTERDAY, YESTERDAY),
                rawStat(2L, null, null, QuestionType.SHORT_ANSWER, 2, 0, 2, YESTERDAY, YESTERDAY),
                rawStat(3L, null, null, QuestionType.SHORT_ANSWER, 2, 0, 2, YESTERDAY, YESTERDAY)
        ));
        when(questionRepository.findAllById(any())).thenReturn(List.of(
                questionWithId(1L), questionWithId(2L), questionWithId(3L)));

        List<TodayReviewQuestionResponse> result = incorrectNoteService.getTodayReview(owner, 2, null);

        assertThat(result).hasSize(2);
    }

    @Test
    void getTodayReviewFiltersByCourseId() {
        LocalDateTime now = YESTERDAY;
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
    void getTodayReviewRejectsTooLargeLimit() {
        assertThatThrownBy(() -> incorrectNoteService.getTodayReview(owner, 101, null))
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

    // 고정 시계(2024-01-12) 기준 어제 풀이. 오답 직후 간격(1일)이 지나 오늘 복습 대상이 된다.
    private static final LocalDateTime YESTERDAY = LocalDateTime.of(2024, 1, 11, 9, 0);

    // (questionId, isCorrect) 쌍을 시간순 풀이 이력으로 만든다.
    private List<UserAnswerRepository.AnswerHistory> history(Object... pairs) {
        List<UserAnswerRepository.AnswerHistory> list = new java.util.ArrayList<>();
        for (int i = 0; i < pairs.length; i += 2) {
            Long questionId = (Long) pairs[i];
            Boolean correct = (Boolean) pairs[i + 1];
            list.add(new UserAnswerRepository.AnswerHistory() {
                public Long getQuestionId() { return questionId; }
                public Boolean getIsCorrect() { return correct; }
            });
        }
        return list;
    }

    private List<TodayReviewQuestionResponse> todayReviewFor(QuestionAnswerStat stat,
                                                            List<UserAnswerRepository.AnswerHistory> answers) {
        when(userAnswerRepository.aggregateByQuestionForStudent(owner.getStudId())).thenReturn(List.of(stat));
        when(questionRepository.findAllById(any())).thenReturn(List.of(question));
        when(userAnswerRepository.findAnswerHistoryForStudent(owner.getStudId())).thenReturn(answers);
        return incorrectNoteService.getTodayReview(owner, 10, null);
    }

    @Test
    void wrongAnswerYesterdayIsDueTodayWithOneDayInterval() {
        List<TodayReviewQuestionResponse> result = todayReviewFor(
                rawStat(40L, null, null, QuestionType.OX, 1, 0, 1, YESTERDAY, YESTERDAY), history(40L, false));

        assertThat(result).singleElement().satisfies(r -> {
            assertThat(r.getStreak()).isZero();
            assertThat(r.getNextReviewAt()).isEqualTo(LocalDate.of(2024, 1, 12));
        });
    }

    @Test
    void questionAnsweredWrongTodayIsNotDueUntilTomorrow() {
        LocalDateTime today = LocalDateTime.of(2024, 1, 12, 10, 0);

        assertThat(todayReviewFor(rawStat(40L, null, null, QuestionType.OX, 1, 0, 1, today, today),
                history(40L, false))).isEmpty();
    }

    @Test
    void oneCorrectAfterWrongWaitsThreeDays() {
        // 마지막 풀이(정답) 2024-01-10 → 다음 복습 01-13이라 01-12에는 아니다.
        LocalDateTime twoDaysAgo = LocalDateTime.of(2024, 1, 10, 9, 0);
        assertThat(todayReviewFor(rawStat(40L, null, null, QuestionType.OX, 2, 1, 1, twoDaysAgo, twoDaysAgo.minusDays(1)),
                history(40L, false, 40L, true))).isEmpty();

        // 마지막 풀이 2024-01-09 → 다음 복습 01-12라 오늘 대상이다.
        LocalDateTime threeDaysAgo = LocalDateTime.of(2024, 1, 9, 9, 0);
        assertThat(todayReviewFor(rawStat(40L, null, null, QuestionType.OX, 2, 1, 1, threeDaysAgo, threeDaysAgo.minusDays(1)),
                history(40L, false, 40L, true))).singleElement()
                .satisfies(r -> assertThat(r.getStreak()).isEqualTo(1));
    }

    @Test
    void repeatIncorrectQuestionGraduatesAfterFiveConsecutiveCorrects() {
        // 예전에는 2번 틀린 문제가 이후 계속 맞혀도 영원히 HIGH로 복습 목록에 남았다.
        LocalDateTime longAgo = LocalDateTime.of(2023, 6, 1, 9, 0);
        QuestionAnswerStat stat = rawStat(40L, null, null, QuestionType.OX, 7, 5, 2, longAgo, longAgo.minusDays(60));
        List<UserAnswerRepository.AnswerHistory> answers =
                history(40L, false, 40L, false, 40L, true, 40L, true, 40L, true, 40L, true, 40L, true);

        assertThat(todayReviewFor(stat, answers)).isEmpty();
        assertThat(incorrectNoteService.getSummary(owner).getReviewTargetCount()).isZero();
    }

    private Question questionFromBlock(Long id, Long noteId, String blockId) {
        Question q = questionWithId(id);
        q.setSourceNoteId(noteId);
        q.setSourceBlockId(blockId);
        return q;
    }

    @Test
    void getBlockStatisticsSumsBySourceBlockAndSkipsUnverifiedQuestions() {
        LocalDateTime now = LocalDateTime.of(2024, 1, 10, 12, 0);
        when(userAnswerRepository.aggregateByQuestionForStudent(owner.getStudId())).thenReturn(List.of(
                // 블록 10/a: 두 문제 합계 4회 중 1회 정답(25%) -> HIGH
                rawStat(1L, null, null, QuestionType.SHORT_ANSWER, 2, 1, 1, now.minusDays(3), now.minusDays(4)),
                rawStat(2L, null, null, QuestionType.SHORT_ANSWER, 2, 0, 2, now.minusDays(2), now.minusDays(2)),
                // 블록 10/b: 4회 모두 정답 -> LOW
                rawStat(3L, null, null, QuestionType.SHORT_ANSWER, 4, 4, 0, now, null),
                // 출처 없음(미검증): 제외
                rawStat(4L, null, null, QuestionType.SHORT_ANSWER, 3, 0, 3, now, now)
        ));
        Question unverified = questionWithId(4L);
        when(questionRepository.findAllById(any())).thenReturn(List.of(
                questionFromBlock(1L, 10L, "a"), questionFromBlock(2L, 10L, "a"),
                questionFromBlock(3L, 10L, "b"), unverified));

        List<SourceBlockStatResponse> result = incorrectNoteService.getBlockStatistics(owner);

        assertThat(result).extracting(SourceBlockStatResponse::getBlockId).containsExactly("a", "b");
        SourceBlockStatResponse weak = result.get(0);
        assertThat(weak.getNoteId()).isEqualTo(10L);
        assertThat(weak.getAttemptCount()).isEqualTo(4);
        assertThat(weak.getCorrectCount()).isEqualTo(1);
        assertThat(weak.getIncorrectCount()).isEqualTo(3);
        assertThat(weak.getAccuracyRate()).isEqualTo(0.25);
        assertThat(weak.getReviewPriority()).isEqualTo(ReviewPriority.HIGH);
        assertThat(result.get(1).getReviewPriority()).isEqualTo(ReviewPriority.LOW);
    }

    @Test
    void getBlockStatisticsMarksBlockHighWhenItsLatestAttemptWasIncorrect() {
        LocalDateTime now = LocalDateTime.of(2024, 1, 10, 12, 0);
        // 정답률 4/5(80%), 오답 1회지만 블록의 가장 최근 풀이(문제 2)가 오답이라 HIGH다.
        when(userAnswerRepository.aggregateByQuestionForStudent(owner.getStudId())).thenReturn(List.of(
                rawStat(1L, null, null, QuestionType.SHORT_ANSWER, 4, 4, 0, now.minusDays(1), null),
                rawStat(2L, null, null, QuestionType.SHORT_ANSWER, 1, 0, 1, now, now)
        ));
        when(questionRepository.findAllById(any())).thenReturn(List.of(
                questionFromBlock(1L, 10L, "a"), questionFromBlock(2L, 10L, "a")));

        List<SourceBlockStatResponse> result = incorrectNoteService.getBlockStatistics(owner);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getReviewPriority()).isEqualTo(ReviewPriority.HIGH);
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
