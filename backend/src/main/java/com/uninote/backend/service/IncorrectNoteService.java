package com.uninote.backend.service;

import com.uninote.backend.domain.*;
import com.uninote.backend.dto.*;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.exception.InvalidRequestException;
import com.uninote.backend.exception.ResourceNotFoundException;
import com.uninote.backend.repository.*;
import lombok.Builder;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
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
            group = groupRepository.findById(request.getGroupId())
                .orElseThrow(() -> new ResourceNotFoundException("오답노트를 찾을 수 없습니다."));
            validateOwnership(group, student);
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
        IncorrectNoteGroup group = groupRepository.findById(groupId)
            .orElseThrow(() -> new ResourceNotFoundException("오답노트를 찾을 수 없습니다."));

        validateOwnership(group, student);

        groupRepository.delete(group);
    }

    @Transactional
    public void removeItemFromGroup(Long groupId, Long questionId, Student student) {
        IncorrectNoteGroup group = groupRepository.findById(groupId)
            .orElseThrow(() -> new ResourceNotFoundException("오답노트를 찾을 수 없습니다."));

        validateOwnership(group, student);

        itemRepository.findByGroup_IdAndQuestion_QuestionId(groupId, questionId)
            .ifPresent(itemRepository::delete);
    }

    @Transactional(readOnly = true)
    public QuizSetDetailResponse getPracticeSession(Long groupId, Student student) {
        IncorrectNoteGroup group = groupRepository.findById(groupId)
            .orElseThrow(() -> new ResourceNotFoundException("오답노트를 찾을 수 없습니다."));

        validateOwnership(group, student);

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

    @Transactional(readOnly = true)
    public List<IncorrectQuestionStatResponse> getQuestionStatistics(Student student) {
        return buildQuestionReviewStats(student).stream()
            .map(s -> IncorrectQuestionStatResponse.builder()
                .questionId(s.getQuestion().getQuestionId())
                .questionText(s.getQuestion().getQuestionText())
                .courseId(s.getCourseId())
                .courseName(s.getCourseName())
                .sourceNoteId(s.getQuestion().getSourceNoteId())
                .sourceBlockId(s.getQuestion().getSourceBlockId())
                .type(s.getQuestion().getType())
                .attemptCount(s.getAttemptCount())
                .correctCount(s.getCorrectCount())
                .incorrectCount(s.getIncorrectCount())
                .lastAttemptedAt(s.getLastAttemptedAt())
                .lastIncorrectAt(s.getLastIncorrectAt())
                .accuracyRate(s.getAccuracyRate())
                .reviewPriority(s.getReviewPriority())
                .build())
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TodayReviewQuestionResponse> getTodayReview(Student student, int limit, Long courseId) {
        if (limit < 1) {
            throw new InvalidRequestException("limit은 1 이상이어야 합니다.");
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

                return QuestionReviewStat.builder()
                    .question(questionsById.get(stat.getQuestionId()))
                    .courseId(stat.getCourseId())
                    .courseName(stat.getCourseName())
                    .attemptCount(stat.getAttemptCount())
                    .correctCount(stat.getCorrectCount())
                    .incorrectCount(stat.getIncorrectCount())
                    .lastAttemptedAt(stat.getLastAttemptedAt())
                    .lastIncorrectAt(stat.getLastIncorrectAt())
                    .accuracyRate(accuracyRate)
                    .recentlyIncorrect(recentlyIncorrect)
                    .reviewPriority(classifyPriority(stat.getIncorrectCount(), accuracyRate, recentlyIncorrect))
                    .build();
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

    @Getter
    @Builder
    private static class QuestionReviewStat {
        private Question question;
        private Long courseId;
        private String courseName;
        private long attemptCount;
        private long correctCount;
        private long incorrectCount;
        private LocalDateTime lastAttemptedAt;
        private LocalDateTime lastIncorrectAt;
        private double accuracyRate;
        private boolean recentlyIncorrect;
        private ReviewPriority reviewPriority;
    }

    private void validateOwnership(IncorrectNoteGroup group, Student student) {
        if (!group.getStudent().getStudId().equals(student.getStudId())) {
            throw new CourseAccessException("본인 오답노트 그룹만 접근할 수 있습니다.");
        }
    }

    // question이 요청 학생 본인의 퀴즈에 속하는지 확인한다. 이 검증이 없으면 다른 학생의
    // 문제 ID를 알아내 자신의 오답노트 그룹에 추가할 수 있었다.
    private void validateQuestionOwnership(Question question, Student student) {
        QuizSet quizSet = question.getQuizSet();
        if (quizSet == null || quizSet.getStudent() == null
                || !quizSet.getStudent().getStudId().equals(student.getStudId())) {
            throw new CourseAccessException("본인 퀴즈의 문제만 오답노트에 추가할 수 있습니다.");
        }
    }
}
