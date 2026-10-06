package com.uninote.backend.service;

import com.uninote.backend.domain.*;
import com.uninote.backend.dto.*;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.exception.InvalidRequestException;
import com.uninote.backend.exception.ResourceNotFoundException;
import com.uninote.backend.repository.*;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.experimental.Delegate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IncorrectNoteService {
    private final IncorrectNoteGroupRepository groupRepository;
    private final IncorrectNoteItemRepository itemRepository;
    private final QuestionRepository questionRepository;
    private final UserAnswerRepository userAnswerRepository;
    private final QuestionResponseMapper questionResponseMapper;
    private final SharedQuizService sharedQuizService;

    @Transactional(readOnly = true)
    public List<IncorrectNoteGroupResponse> getMyGroups(Student student) {
        return groupRepository.findByStudent_StudId(student.getStudId()).stream()
            .map(g -> IncorrectNoteGroupResponse.builder()
                .id(g.getId())
                .title(g.getTitle())
                .itemCount(g.getItems().size())
                .createdAt(g.getCreatedAt())
                .build())
            .collect(Collectors.toList());
    }

    @Transactional
    public void addToGroup(AddToIncorrectRequest request, Student student) {
        IncorrectNoteGroup group;
        
        if (request.getGroupId() != null) {
            group = getOwnedGroup(request.getGroupId(), student);
        } else if (request.getNewGroupTitle() != null && !request.getNewGroupTitle().trim().isEmpty()) {
            group = groupRepository.findByStudent_StudIdAndTitle(student.getStudId(), request.getNewGroupTitle())
                .orElseGet(() -> {
                    IncorrectNoteGroup newGroup = new IncorrectNoteGroup();
                    newGroup.setStudent(student);
                    newGroup.setTitle(request.getNewGroupTitle());
                    return groupRepository.save(newGroup);
                });
        } else {
            throw new InvalidRequestException("그룹 ID 또는 새 그룹 제목이 필요합니다.");
        }

        Question question = questionRepository.findById(request.getQuestionId())
            .orElseThrow(() -> new ResourceNotFoundException("문제를 찾을 수 없습니다."));

        validateQuestionOwnership(question, student);

        // 중복 체크
        if (itemRepository.findByGroup_IdAndQuestion_QuestionId(group.getId(), question.getQuestionId()).isEmpty()) {
            IncorrectNoteItem item = new IncorrectNoteItem();
            item.setGroup(group);
            item.setQuestion(question);
            itemRepository.save(item);
        }
    }

    @Transactional
    public void deleteGroup(Long groupId, Student student) {
        groupRepository.delete(getOwnedGroup(groupId, student));
    }

    @Transactional(readOnly = true)
    public QuizSetDetailResponse getPracticeSession(Long groupId, Student student) {
        IncorrectNoteGroup group = getOwnedGroup(groupId, student);

        List<QuestionResponse> questions = group.getItems().stream()
            .map(item -> questionResponseMapper.toResponse(item.getQuestion()))
            .collect(Collectors.toList());

        return QuizSetDetailResponse.builder()
            .quizSetId(-1L) // 가상 ID
            .title(group.getTitle() + " (오답 복습)")
            .difficulty(QuizDifficulty.NORMAL)
            .questions(questions)
            .build();
    }

    @Transactional(readOnly = true)
    public IncorrectSummaryResponse getSummary(Student student) {
        List<QuestionReviewStat> stats = buildQuestionReviewStats(student);

        long totalAttemptCount = stats.stream().mapToLong(QuestionReviewStat::getAttemptCount).sum();
        long correctCount = stats.stream().mapToLong(QuestionReviewStat::getCorrectCount).sum();
        long incorrectCount = stats.stream().mapToLong(QuestionReviewStat::getIncorrectCount).sum();
        long reviewTargetCount = stats.stream().filter(s -> s.getReviewPriority() != ReviewPriority.LOW).count();
        long repeatIncorrectCount = stats.stream().filter(s -> s.getIncorrectCount() >= 2).count();

        return IncorrectSummaryResponse.builder()
            .totalAttemptCount(totalAttemptCount)
            .totalQuestionCount(stats.size())
            .correctCount(correctCount)
            .incorrectCount(incorrectCount)
            .accuracyRate(totalAttemptCount == 0 ? 0.0 : (double) correctCount / totalAttemptCount)
            .reviewTargetCount(reviewTargetCount)
            .repeatIncorrectCount(repeatIncorrectCount)
            .build();
    }

    @Transactional(readOnly = true)
    public List<CourseIncorrectStatResponse> getCourseStatistics(Student student) {
        List<QuestionReviewStat> stats = buildQuestionReviewStats(student);

        return stats.stream()
            .filter(s -> s.getCourseId() != null)
            .collect(Collectors.groupingBy(QuestionReviewStat::getCourseId))
            .values().stream()
            .map(group -> {
                QuestionReviewStat first = group.get(0);
                long correct = group.stream().mapToLong(QuestionReviewStat::getCorrectCount).sum();
                long incorrect = group.stream().mapToLong(QuestionReviewStat::getIncorrectCount).sum();
                long attempts = correct + incorrect;
                long reviewTargetCount = group.stream().filter(s -> s.getReviewPriority() != ReviewPriority.LOW).count();
                return CourseIncorrectStatResponse.builder()
                    .courseId(first.getCourseId())
                    .courseName(first.getCourseName())
                    .questionCount(group.size())
                    .correctCount(correct)
                    .incorrectCount(incorrect)
                    .accuracyRate(attempts == 0 ? 0.0 : (double) correct / attempts)
                    .reviewTargetCount(reviewTargetCount)
                    .build();
            })
            .sorted(Comparator.comparingDouble(CourseIncorrectStatResponse::getAccuracyRate)) // 취약 강의 먼저
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<QuestionTypeIncorrectStatResponse> getTypeStatistics(Student student) {
        List<QuestionReviewStat> stats = buildQuestionReviewStats(student);

        return stats.stream()
            .collect(Collectors.groupingBy(s -> s.getQuestion().getType()))
            .entrySet().stream()
            .map(entry -> {
                List<QuestionReviewStat> group = entry.getValue();
                long correct = group.stream().mapToLong(QuestionReviewStat::getCorrectCount).sum();
                long incorrect = group.stream().mapToLong(QuestionReviewStat::getIncorrectCount).sum();
                long attempts = correct + incorrect;
                return QuestionTypeIncorrectStatResponse.builder()
                    .type(entry.getKey())
                    .attemptCount(attempts)
                    .correctCount(correct)
                    .incorrectCount(incorrect)
                    .accuracyRate(attempts == 0 ? 0.0 : (double) correct / attempts)
                    .build();
            })
            .sorted(Comparator.comparingDouble(QuestionTypeIncorrectStatResponse::getAccuracyRate)) // 취약 유형 먼저
            .collect(Collectors.toList());
    }

    // 출처 블록(noteId/blockId)별 풀이 통계. 출처가 없는(미검증) 문제는 제외하고, 취약도는
    // 문제별 복습 우선순위와 같은 규칙(classifyPriority)으로 블록 합계에 적용한다.
    @Transactional(readOnly = true)
    public List<SourceBlockStatResponse> getBlockStatistics(Student student) {
        return buildQuestionReviewStats(student).stream()
            .filter(s -> s.getQuestion().getSourceNoteId() != null && s.getQuestion().getSourceBlockId() != null)
            .collect(Collectors.groupingBy(s -> List.of(s.getQuestion().getSourceNoteId(), s.getQuestion().getSourceBlockId())))
            .values().stream()
            .map(group -> {
                Question first = group.get(0).getQuestion();
                long correct = group.stream().mapToLong(QuestionReviewStat::getCorrectCount).sum();
                long incorrect = group.stream().mapToLong(QuestionReviewStat::getIncorrectCount).sum();
                long attempts = correct + incorrect;
                double accuracyRate = attempts == 0 ? 0.0 : (double) correct / attempts;
                LocalDateTime lastAttemptedAt = group.stream().map(QuestionReviewStat::getLastAttemptedAt)
                    .filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null);
                LocalDateTime lastIncorrectAt = group.stream().map(QuestionReviewStat::getLastIncorrectAt)
                    .filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null);
                boolean recentlyIncorrect = lastIncorrectAt != null && lastIncorrectAt.equals(lastAttemptedAt);
                return SourceBlockStatResponse.builder()
                    .noteId(first.getSourceNoteId())
                    .blockId(first.getSourceBlockId())
                    .attemptCount(attempts)
                    .correctCount(correct)
                    .incorrectCount(incorrect)
                    .accuracyRate(accuracyRate)
                    .reviewPriority(classifyPriority(incorrect, accuracyRate, recentlyIncorrect))
                    .build();
            })
            // 취약 블록 먼저: 우선순위(HIGH → LOW, enum 선언 순서) → 정답률 오름차순
            .sorted(Comparator.comparing(SourceBlockStatResponse::getReviewPriority)
                .thenComparingDouble(SourceBlockStatResponse::getAccuracyRate))
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TodayReviewQuestionResponse> getTodayReview(Student student, int limit, Long courseId) {
        if (limit < 1 || limit > 100) {
            throw new InvalidRequestException("limit은 1 이상 100 이하여야 합니다.");
        }

        return buildQuestionReviewStats(student).stream()
            .filter(s -> s.getReviewPriority() != ReviewPriority.LOW)
            .filter(s -> courseId == null || courseId.equals(s.getCourseId()))
            .limit(limit)
            .map(s -> TodayReviewQuestionResponse.builder()
                .question(questionResponseMapper.toResponse(s.getQuestion()))
                .courseId(s.getCourseId())
                .courseName(s.getCourseName())
                .attemptCount(s.getAttemptCount())
                .incorrectCount(s.getIncorrectCount())
                .lastIncorrectAt(s.getLastIncorrectAt())
                .reviewPriority(s.getReviewPriority())
                .build())
            .collect(Collectors.toList());
    }

    // 문제별 통계(전체/강의별/유형별/오늘의 복습)가 모두 이 한 번의 집계 쿼리 결과를 공유하도록
    // 하여, 서로 다른 엔드포인트의 숫자가 어긋나지 않게 한다.
    private List<QuestionReviewStat> buildQuestionReviewStats(Student student) {
        List<QuestionAnswerStat> rawStats = userAnswerRepository.aggregateByQuestionForStudent(student.getStudId());
        if (rawStats.isEmpty()) {
            return List.of();
        }

        Map<Long, Question> questionsById = questionRepository
            .findAllById(rawStats.stream().map(QuestionAnswerStat::getQuestionId).collect(Collectors.toList()))
            .stream()
            .collect(Collectors.toMap(Question::getQuestionId, Function.identity()));

        return rawStats.stream()
            .filter(stat -> questionsById.containsKey(stat.getQuestionId())) // 삭제된 문제 방어
            .map(stat -> {
                boolean recentlyIncorrect = stat.getLastIncorrectAt() != null
                    && stat.getLastIncorrectAt().equals(stat.getLastAttemptedAt());
                double accuracyRate = stat.getAttemptCount() == 0 ? 0.0
                    : (double) stat.getCorrectCount() / stat.getAttemptCount();

                return new QuestionReviewStat(stat, questionsById.get(stat.getQuestionId()), accuracyRate,
                    recentlyIncorrect, classifyPriority(stat.getIncorrectCount(), accuracyRate, recentlyIncorrect));
            })
            .sorted(PRIORITY_ORDER)
            .collect(Collectors.toList());
    }

    // 복습 우선순위 정렬: 반복 오답 수 desc → 최근 오답 여부 desc → 마지막 풀이일 asc(오래된 것
    // 먼저) → 문제 ID asc(생성 순서 근사 — Question에 별도 생성일 컬럼이 없어 IDENTITY 채번
    // 순서를 대신 쓴다).
    private static final Comparator<QuestionReviewStat> PRIORITY_ORDER = Comparator
        .comparingLong(QuestionReviewStat::getIncorrectCount).reversed()
        .thenComparing(QuestionReviewStat::isRecentlyIncorrect, Comparator.reverseOrder())
        .thenComparing(QuestionReviewStat::getLastAttemptedAt, Comparator.nullsLast(Comparator.naturalOrder()))
        .thenComparing(s -> s.getQuestion().getQuestionId());

    // HIGH 조건을 먼저 검사한다(계획 문서의 HIGH/MEDIUM 항목이 서로 배타적이지 않게 쓰여 있어,
    // MEDIUM은 HIGH가 아닌 나머지 정답률 구간(50~75%)으로 단순화했다).
    private ReviewPriority classifyPriority(long incorrectCount, double accuracyRate, boolean recentlyIncorrect) {
        boolean repeatIncorrect = incorrectCount >= 2;
        if (recentlyIncorrect || repeatIncorrect || accuracyRate < 0.5) {
            return ReviewPriority.HIGH;
        }
        if (accuracyRate < 0.75) {
            return ReviewPriority.MEDIUM;
        }
        return ReviewPriority.LOW;
    }

    // 집계 결과(stat)의 getter는 그대로 위임하고, 여기서는 파생 값만 보관한다.
    @Getter
    @RequiredArgsConstructor
    private static class QuestionReviewStat {
        @Delegate
        private final QuestionAnswerStat stat;
        private final Question question;
        private final double accuracyRate;
        private final boolean recentlyIncorrect;
        private final ReviewPriority reviewPriority;
    }

    private IncorrectNoteGroup getOwnedGroup(Long groupId, Student student) {
        IncorrectNoteGroup group = groupRepository.findById(groupId)
            .orElseThrow(() -> new ResourceNotFoundException("오답노트를 찾을 수 없습니다."));
        if (!group.getStudent().getStudId().equals(student.getStudId())) {
            throw new CourseAccessException("본인 오답노트 그룹만 접근할 수 있습니다.");
        }
        return group;
    }

    // question이 요청 학생 본인의 퀴즈에 속하는지 확인한다. 이 검증이 없으면 다른 학생의
    // 문제 ID를 알아내 자신의 오답노트 그룹에 추가할 수 있었다. 공유게시판 문제는
    // SharedQuizService의 접근 규칙(게시 중·이미 풂·이미 담음)을 통과하면 허용한다.
    private void validateQuestionOwnership(Question question, Student student) {
        QuizSet quizSet = question.getQuizSet();
        boolean owner = quizSet != null && quizSet.getStudent() != null
                && quizSet.getStudent().getStudId().equals(student.getStudId());
        if (!owner && !sharedQuizService.canAccessQuestion(question, student)) {
            throw new CourseAccessException("본인 퀴즈의 문제만 오답노트에 추가할 수 있습니다.");
        }
    }
}
