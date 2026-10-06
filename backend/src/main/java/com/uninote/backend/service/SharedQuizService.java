package com.uninote.backend.service;

import com.uninote.backend.domain.*;
import com.uninote.backend.dto.*;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.exception.InvalidRequestException;
import com.uninote.backend.exception.ResourceNotFoundException;
import com.uninote.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

// CBT 시험 공유게시판. 공유 시 원본 퀴즈를 소유자 없는 스냅샷으로 복사하므로, 원본 삭제·글 삭제가
// 다른 학생의 풀이 기록·오답노트에 영향을 주지 않는다.
@Service
@RequiredArgsConstructor
public class SharedQuizService {
    private final SharedQuizRepository sharedQuizRepository;
    private final SharedQuizLikeRepository sharedQuizLikeRepository;
    private final QuizSetRepository quizSetRepository;
    private final QuestionRepository questionRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final UserAnswerRepository userAnswerRepository;
    private final IncorrectNoteItemRepository incorrectNoteItemRepository;
    private final QuestionResponseMapper questionResponseMapper;
    private final SharedQuizCommentRepository sharedQuizCommentRepository;

    // ponytail: 페이지네이션 없이 수강 강의의 글 전체를 반환한다. 글이 많아지면 Pageable로 바꾼다.
    @Transactional(readOnly = true)
    public List<SharedQuizResponse> getSharedQuizzes(Student student, String sort, Long courseId) {
        Sort order = sortOf(sort);
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

        List<SharedQuiz> posts = sharedQuizRepository.findByCourseIds(courseIds, order);
        if (posts.isEmpty()) {
            return List.of();
        }

        List<Long> quizSetIds = posts.stream().map(p -> p.getQuizSet().getQuizSetId()).collect(Collectors.toList());
        Map<Long, Long> questionCounts = questionRepository.countByQuizSetIdIn(quizSetIds).stream()
            .collect(Collectors.toMap(QuizSetQuestionCount::getQuizSetId, QuizSetQuestionCount::getCount));
        Set<Long> likedIds = sharedQuizLikeRepository.findLikedSharedQuizIds(student.getStudId(),
            posts.stream().map(SharedQuiz::getSharedQuizId).collect(Collectors.toList()));

        return posts.stream()
            .map(p -> SharedQuizResponse.builder()
                .sharedQuizId(p.getSharedQuizId())
                .quizSetId(p.getQuizSet().getQuizSetId())
                .courseId(p.getCourse().getCourseId())
                .courseName(p.getCourse().getCourseName())
                .title(p.getQuizSet().getTitle())
                .difficulty(p.getQuizSet().getDifficulty())
                .questionCount(questionCounts.getOrDefault(p.getQuizSet().getQuizSetId(), 0L).intValue())
                .authorName(PostService.anonymousName(p.getStudent()))
                .author(p.getStudent().getStudId().equals(student.getStudId()))
                .likeCount(p.getLikeCount())
                .viewCount(p.getViewCount())
                .liked(likedIds.contains(p.getSharedQuizId()))
                .createdAt(p.getCreatedAt())
                .build())
            .collect(Collectors.toList());
    }

    @Transactional
    public void share(Long quizSetId, Student student) {
        QuizSet origin = quizSetRepository.findById(quizSetId)
            .orElseThrow(() -> new ResourceNotFoundException("퀴즈를 찾을 수 없습니다."));
        if (origin.getStudent() == null || !origin.getStudent().getStudId().equals(student.getStudId())) {
            throw new CourseAccessException("본인 퀴즈만 공유할 수 있습니다.");
        }
        if (origin.getCourse() == null) {
            throw new InvalidRequestException("강의가 없는 퀴즈는 공유할 수 없습니다.");
        }
        validateEnrollment(student, origin.getCourse().getCourseId());
        if (sharedQuizRepository.existsBySourceQuizSetId(quizSetId)) {
            throw new InvalidRequestException("이미 공유된 퀴즈입니다.");
        }

        SharedQuiz post = new SharedQuiz();
        post.setQuizSet(quizSetRepository.save(snapshotOf(origin)));
        post.setStudent(student);
        post.setCourse(origin.getCourse());
        post.setSourceQuizSetId(quizSetId);
        sharedQuizRepository.save(post);
    }

    // 글과 추천만 지운다. 스냅샷 QuizSet은 다른 학생의 오답노트·풀이 기록이 참조하므로 남긴다.
    // ponytail: 아무도 참조하지 않는 스냅샷도 남는다. 쌓여서 문제가 되면 정리 배치를 추가한다.
    @Transactional
    public void deletePost(Long sharedQuizId, Student student) {
        SharedQuiz post = getPost(sharedQuizId);
        if (!post.getStudent().getStudId().equals(student.getStudId())) {
            throw new CourseAccessException("작성자 본인만 삭제할 수 있습니다.");
        }
        sharedQuizRepository.delete(post);
    }

    // 풀기 화면용 상세. 열 때마다 조회수가 1 오른다.
    @Transactional
    public QuizSetDetailResponse getDetail(Long sharedQuizId, Student student) {
        SharedQuiz post = getPost(sharedQuizId);
        validateEnrollment(student, post.getCourse().getCourseId());
        sharedQuizRepository.incrementViewCount(sharedQuizId);

        QuizSet quizSet = post.getQuizSet();
        return QuizSetDetailResponse.builder()
            .quizSetId(quizSet.getQuizSetId())
            .title(quizSet.getTitle())
            .difficulty(quizSet.getDifficulty())
            .questions(quizSet.getQuestions().stream()
                .map(questionResponseMapper::toResponse)
                .collect(Collectors.toList()))
            .build();
    }

    @Transactional
    public SharedQuizLikeResponse toggleLike(Long sharedQuizId, Student student) {
        SharedQuiz post = getPost(sharedQuizId);
        validateEnrollment(student, post.getCourse().getCourseId());

        boolean liked = sharedQuizLikeRepository
            .findBySharedQuiz_SharedQuizIdAndStudent_StudId(sharedQuizId, student.getStudId())
            .map(like -> {
                sharedQuizLikeRepository.delete(like);
                sharedQuizRepository.addLikeCount(sharedQuizId, -1);
                return false;
            })
            .orElseGet(() -> {
                SharedQuizLike like = new SharedQuizLike();
                like.setSharedQuiz(post);
                like.setStudent(student);
                sharedQuizLikeRepository.save(like);
                sharedQuizRepository.addLikeCount(sharedQuizId, 1);
                return true;
            });

        return SharedQuizLikeResponse.builder()
            .liked(liked)
            .likeCount(sharedQuizLikeRepository.countBySharedQuiz_SharedQuizId(sharedQuizId))
            .build();
    }

    // 내 퀴즈 목록에서 공유된 원본을 표시하기 위해 쓴다.
    @Transactional(readOnly = true)
    public Set<Long> findSharedSourceQuizSetIds(List<Long> quizSetIds) {
        return quizSetIds.isEmpty() ? Set.of() : sharedQuizRepository.findSharedSourceQuizSetIds(quizSetIds);
    }

    // 게시 중인 공유 스냅샷이고, 그 강의를 수강 중이면 세트 단위로 풀 수 있다.
    @Transactional(readOnly = true)
    public boolean canSolve(QuizSet quizSet, Student student) {
        return quizSet.getCourse() != null
            && sharedQuizRepository.existsByQuizSet_QuizSetId(quizSet.getQuizSetId())
            && enrollmentRepository.existsByStudentAndCourse_CourseId(student, quizSet.getCourse().getCourseId());
    }

    // 남의 문제에 대한 접근 규칙. 본인 문제 여부는 호출부가 먼저 확인한다.
    // 글이 삭제된 뒤에도 이미 풀었거나 오답노트에 담은 문제는 재풀이·복습을 계속할 수 있다.
    @Transactional(readOnly = true)
    public boolean canAccessQuestion(Question question, Student student) {
        return (question.getQuizSet() != null && canSolve(question.getQuizSet(), student))
            || userAnswerRepository.existsByQuizAttempt_Student_StudIdAndQuestion_QuestionId(
                student.getStudId(), question.getQuestionId())
            || incorrectNoteItemRepository.existsByGroup_Student_StudIdAndQuestion_QuestionId(
                student.getStudId(), question.getQuestionId());
    }

    // 글 전체 댓글을 문제별로 묶어 반환한다(오래된 순). 결과 화면이 한 번에 받아 문제 카드마다 나눠 보여 준다.
    @Transactional(readOnly = true)
    public Map<Long, List<CommentResponse>> getComments(Long sharedQuizId, Student student) {
        SharedQuiz post = getPost(sharedQuizId);
        validateEnrollment(student, post.getCourse().getCourseId());
        return sharedQuizCommentRepository.findBySharedQuizId(sharedQuizId).stream()
            .collect(Collectors.groupingBy(c -> c.getQuestion().getQuestionId(), LinkedHashMap::new,
                Collectors.mapping(c -> toCommentResponse(c, student), Collectors.toList())));
    }

    @Transactional
    public CommentResponse addComment(Long sharedQuizId, Long questionId, String content, Student student) {
        SharedQuiz post = getPost(sharedQuizId);
        validateEnrollment(student, post.getCourse().getCourseId());
        Question question = post.getQuizSet().getQuestions().stream()
            .filter(q -> q.getQuestionId().equals(questionId))
            .findFirst()
            .orElseThrow(() -> new InvalidRequestException("이 시험에 속하지 않는 문제입니다."));

        SharedQuizComment comment = new SharedQuizComment();
        comment.setSharedQuiz(post);
        comment.setQuestion(question);
        comment.setStudent(student);
        comment.setContent(content);
        return toCommentResponse(sharedQuizCommentRepository.save(comment), student);
    }

    @Transactional
    public CommentResponse updateComment(Long commentId, String content, Student student) {
        SharedQuizComment comment = getOwnedComment(commentId, student, "작성자 본인만 수정할 수 있습니다.");
        comment.setContent(content);
        return toCommentResponse(comment, student);
    }

    @Transactional
    public void deleteComment(Long commentId, Student student) {
        sharedQuizCommentRepository.delete(getOwnedComment(commentId, student, "작성자 본인만 삭제할 수 있습니다."));
    }

    private SharedQuizComment getOwnedComment(Long commentId, Student student, String message) {
        SharedQuizComment comment = sharedQuizCommentRepository.findById(commentId)
            .orElseThrow(() -> new ResourceNotFoundException("댓글을 찾을 수 없습니다."));
        if (!comment.getStudent().getStudId().equals(student.getStudId())) {
            throw new CourseAccessException(message);
        }
        return comment;
    }

    private static CommentResponse toCommentResponse(SharedQuizComment c, Student viewer) {
        return CommentResponse.builder()
            .commentId(c.getCommentId())
            .content(c.getContent())
            .authorName(PostService.anonymousName(c.getStudent()))
            .author(c.getStudent().getStudId().equals(viewer.getStudId()))
            .createdAt(c.getCreatedAt())
            .build();
    }

    // 소유자 없는 복사본. 원문 보기를 막기 위해 출처(sourceNoteId/sourceBlockId)는 복사하지 않는다.
    private static QuizSet snapshotOf(QuizSet origin) {
        QuizSet copy = new QuizSet();
        copy.setCourse(origin.getCourse());
        copy.setTitle(origin.getTitle());
        copy.setDifficulty(origin.getDifficulty());
        for (Question q : origin.getQuestions()) {
            Question c = new Question();
            c.setQuizSet(copy);
            c.setType(q.getType());
            c.setQuestionText(q.getQuestionText());
            c.setOptions(q.getOptions());
            c.setCorrectAnswer(q.getCorrectAnswer());
            c.setExplanation(q.getExplanation());
            copy.getQuestions().add(c);
        }
        return copy;
    }

    private static Sort sortOf(String sort) {
        Sort latest = Sort.by(Sort.Direction.DESC, "createdAt");
        return switch (sort) {
            case "latest" -> latest;
            case "likes" -> Sort.by(Sort.Direction.DESC, "likeCount").and(latest);
            case "views" -> Sort.by(Sort.Direction.DESC, "viewCount").and(latest);
            default -> throw new InvalidRequestException("정렬 기준은 latest, likes, views 중 하나여야 합니다.");
        };
    }

    private SharedQuiz getPost(Long sharedQuizId) {
        return sharedQuizRepository.findById(sharedQuizId)
            .orElseThrow(() -> new ResourceNotFoundException("공유된 시험을 찾을 수 없습니다."));
    }

    private void validateEnrollment(Student student, Long courseId) {
        if (!enrollmentRepository.existsByStudentAndCourse_CourseId(student, courseId)) {
            throw new CourseAccessException("해당 강의를 수강하지 않습니다.");
        }
    }
}
