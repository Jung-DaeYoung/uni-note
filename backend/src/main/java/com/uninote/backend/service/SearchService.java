package com.uninote.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uninote.backend.domain.Enrollment;
import com.uninote.backend.domain.Note;
import com.uninote.backend.domain.Post;
import com.uninote.backend.domain.Question;
import com.uninote.backend.domain.SharedNotePost;
import com.uninote.backend.domain.SharedQuiz;
import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.SearchResponse;
import com.uninote.backend.dto.SearchResultResponse;
import com.uninote.backend.dto.SearchResultResponse.Type;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.exception.InvalidRequestException;
import com.uninote.backend.repository.CourseRepository;
import com.uninote.backend.repository.EnrollmentRepository;
import com.uninote.backend.repository.NoteRepository;
import com.uninote.backend.repository.PostRepository;
import com.uninote.backend.repository.QuestionRepository;
import com.uninote.backend.repository.SharedNotePostRepository;
import com.uninote.backend.repository.SharedQuizRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.domain.SliceImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

// 노트·강의 게시판·노트 공유·문제 공유를 찾는 통합 검색.
// 내 노트는 작성자 기준이고(직접 만든 강의 포함), 나머지는 수강 강의로 제한한다.
// ponytail: 인덱스 없는 LIKE 검색이다. 범위가 학생·수강 강의로 좁아 충분하며, 측정 결과 느리면 전문 검색 인덱스를 둔다.
@Slf4j
@Service
@RequiredArgsConstructor
public class SearchService {
    static final int MIN_QUERY_LENGTH = 2;
    static final int MAX_QUERY_LENGTH = 100;
    static final int ALL_TYPE_LIMIT = 5;
    static final int MAX_PAGE_SIZE = 50;

    private static final Map<String, Type> TYPES = Map.of(
            "note", Type.NOTE,
            "post", Type.COURSE_POST,
            "shared_note", Type.SHARED_NOTE,
            "shared_quiz", Type.SHARED_QUIZ);

    private final NoteRepository noteRepository;
    private final PostRepository postRepository;
    private final SharedNotePostRepository sharedNotePostRepository;
    private final SharedQuizRepository sharedQuizRepository;
    private final QuestionRepository questionRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CourseRepository courseRepository;
    private final ObjectMapper objectMapper;

    private record Scope(Long studId, Long courseId, List<Long> boardCourseIds, String needle, String pattern) {
    }

    @Transactional(readOnly = true)
    public SearchResponse search(Student student, String rawQuery, String rawType, Long courseId, int page, int size) {
        String query = rawQuery == null ? "" : rawQuery.trim();
        if (query.length() < MIN_QUERY_LENGTH || query.length() > MAX_QUERY_LENGTH) {
            throw new InvalidRequestException("검색어는 " + MIN_QUERY_LENGTH + "~" + MAX_QUERY_LENGTH + "자로 입력해 주세요.");
        }
        boolean all = "all".equals(rawType);
        if (!all && !TYPES.containsKey(rawType)) {
            throw new InvalidRequestException("지원하지 않는 검색 유형입니다.");
        }
        if (page < 0 || size < 1) {
            throw new InvalidRequestException("페이지 정보가 올바르지 않습니다.");
        }

        String needle = query.toLowerCase(Locale.ROOT);
        Scope scope = new Scope(student.getStudId(), courseId, boardCourseIds(student, courseId),
                needle, KeywordService.likePattern(needle));
        Pageable pageable = all
                ? PageRequest.of(0, ALL_TYPE_LIMIT)
                : PageRequest.of(page, Math.min(size, MAX_PAGE_SIZE));

        List<SearchResponse.Group> groups = new ArrayList<>();
        for (Type type : all ? List.of(Type.values()) : List.of(TYPES.get(rawType))) {
            Slice<SearchResultResponse> slice = searchType(type, scope, pageable);
            if (slice.hasContent()) {
                groups.add(new SearchResponse.Group(type, slice.hasNext(), slice.getContent()));
            }
        }
        return new SearchResponse(query, groups);
    }

    // 게시판·공유를 찾을 강의. 직접 만든 강의에는 게시판·공유가 없으므로 오류 없이 빈 목록을 돌려준다.
    // 수강도 소유도 아닌 강의를 지정하면 거부한다.
    private List<Long> boardCourseIds(Student student, Long courseId) {
        List<Long> enrolled = enrollmentRepository.findByStudent(student).stream()
                .map(Enrollment::getCourse)
                .map(course -> course.getCourseId())
                .toList();
        if (courseId == null) {
            return enrolled;
        }
        if (enrolled.contains(courseId)) {
            return List.of(courseId);
        }
        if (courseRepository.existsByCourseIdAndUserCreatedTrueAndOwner_StudId(courseId, student.getStudId())) {
            return List.of();
        }
        throw new CourseAccessException("해당 강의를 수강하지 않습니다.");
    }

    private Slice<SearchResultResponse> searchType(Type type, Scope scope, Pageable pageable) {
        if (type == Type.NOTE) {
            return noteRepository.search(scope.studId(), scope.courseId(), scope.pattern(), pageable)
                    .map(note -> toNoteResult(note, scope.needle()));
        }
        // IN () 쿼리를 만들지 않는다.
        if (scope.boardCourseIds().isEmpty()) {
            return new SliceImpl<>(List.of());
        }
        return switch (type) {
            case COURSE_POST -> postRepository.search(scope.boardCourseIds(), scope.pattern(), pageable)
                    .map(post -> toPostResult(post, scope.needle()));
            case SHARED_NOTE -> sharedNotePostRepository.search(scope.boardCourseIds(), scope.pattern(), pageable)
                    .map(SearchService::toSharedNoteResult);
            default -> searchSharedQuizzes(scope, pageable);
        };
    }

    // 제목만 일치했거나 블록을 찾지 못한 노트도 결과에 남긴다(blockId null이면 노트만 연다).
    private SearchResultResponse toNoteResult(Note note, String needle) {
        String blockId = null;
        String preview = null;
        try {
            for (JsonNode block : objectMapper.readTree(note.getContent()).path("content")) {
                String text = normalize(KeywordService.collectText(block));
                int index = text.toLowerCase(Locale.ROOT).indexOf(needle);
                if (index >= 0) {
                    blockId = block.path("attrs").path("id").asText(null);
                    preview = KeywordService.preview(text, index, needle.length());
                    break;
                }
            }
        } catch (JsonProcessingException | IllegalArgumentException e) {
            // 읽기 전용 검색이라 깨진 노트 하나로 전체를 실패시키지 않는다.
            log.warn("통합 검색: 노트 {} 본문을 해석하지 못했습니다.", note.getNoteId());
        }
        if (preview == null) {
            preview = previewOf(note.getSearchContent(), needle);
        }
        return new SearchResultResponse(Type.NOTE, note.getNoteId(), blockId, note.getTitle(), preview,
                note.getCourse().getCourseId(), note.getCourse().getCourseName(), null, note.getUpdatedAt());
    }

    private static SearchResultResponse toPostResult(Post post, String needle) {
        return new SearchResultResponse(Type.COURSE_POST, post.getPostId(), null, post.getTitle(),
                previewOf(post.getContent(), needle), post.getCourse().getCourseId(), post.getCourse().getCourseName(),
                PostService.anonymousName(post.getStudent()), post.getCreatedAt());
    }

    private static SearchResultResponse toSharedNoteResult(SharedNotePost post) {
        return new SearchResultResponse(Type.SHARED_NOTE, post.getSharedNotePostId(), null, post.getTitle(), null,
                post.getCourse().getCourseId(), post.getCourse().getCourseName(),
                PostService.anonymousName(post.getStudent()), post.getCreatedAt());
    }

    private Slice<SearchResultResponse> searchSharedQuizzes(Scope scope, Pageable pageable) {
        Slice<SharedQuiz> quizzes = sharedQuizRepository.search(scope.boardCourseIds(), scope.pattern(), pageable);
        if (!quizzes.hasContent()) {
            return new SliceImpl<>(List.of());
        }
        List<Long> quizSetIds = quizzes.map(quiz -> quiz.getQuizSet().getQuizSetId()).getContent();
        Map<Long, String> previews = new HashMap<>();
        for (Question question : questionRepository.findMatching(quizSetIds, scope.pattern())) {
            previews.putIfAbsent(question.getQuizSet().getQuizSetId(), previewOf(question.getQuestionText(), scope.needle()));
        }
        return quizzes.map(quiz -> new SearchResultResponse(Type.SHARED_QUIZ, quiz.getSharedQuizId(), null,
                quiz.getQuizSet().getTitle(), previews.get(quiz.getQuizSet().getQuizSetId()),
                quiz.getCourse().getCourseId(), quiz.getCourse().getCourseName(),
                PostService.anonymousName(quiz.getStudent()), quiz.getCreatedAt()));
    }

    private static String previewOf(String rawText, String needle) {
        if (rawText == null) {
            return null;
        }
        String text = normalize(rawText);
        int index = text.toLowerCase(Locale.ROOT).indexOf(needle);
        return index < 0 ? null : KeywordService.preview(text, index, needle.length());
    }

    private static String normalize(String text) {
        return text.replaceAll("\\s+", " ").trim();
    }
}
