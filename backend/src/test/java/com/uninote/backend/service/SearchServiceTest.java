package com.uninote.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uninote.backend.domain.Course;
import com.uninote.backend.domain.Enrollment;
import com.uninote.backend.domain.Note;
import com.uninote.backend.domain.Post;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.SliceImpl;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SearchServiceTest {
    private final NoteRepository noteRepository = mock(NoteRepository.class);
    private final PostRepository postRepository = mock(PostRepository.class);
    private final SharedNotePostRepository sharedNotePostRepository = mock(SharedNotePostRepository.class);
    private final SharedQuizRepository sharedQuizRepository = mock(SharedQuizRepository.class);
    private final QuestionRepository questionRepository = mock(QuestionRepository.class);
    private final EnrollmentRepository enrollmentRepository = mock(EnrollmentRepository.class);
    private final CourseRepository courseRepository = mock(CourseRepository.class);
    private final SearchService service = new SearchService(noteRepository, postRepository, sharedNotePostRepository,
            sharedQuizRepository, questionRepository, enrollmentRepository, courseRepository, new ObjectMapper());

    private final Student student = new Student();
    private final Course course = new Course();

    @BeforeEach
    void setUp() {
        student.setStudId(1L);
        student.setStudentNum("2021001");
        student.setName("홍길동");
        course.setCourseId(7L);
        course.setCourseName("운영체제");
        Enrollment enrollment = new Enrollment();
        enrollment.setCourse(course);
        when(enrollmentRepository.findByStudent(student)).thenReturn(List.of(enrollment));
        when(noteRepository.search(any(), any(), any(), any())).thenReturn(new SliceImpl<>(List.of()));
        when(postRepository.search(anyList(), any(), any())).thenReturn(new SliceImpl<>(List.of()));
        when(sharedNotePostRepository.search(anyList(), any(), any())).thenReturn(new SliceImpl<>(List.of()));
        when(sharedQuizRepository.search(anyList(), any(), any())).thenReturn(new SliceImpl<>(List.of()));
    }

    private Note note(String title, String content, String searchContent) {
        Note note = new Note();
        note.setNoteId(12L);
        note.setCourse(course);
        note.setTitle(title);
        note.setContent(content);
        note.setSearchContent(searchContent);
        return note;
    }

    private SearchResultResponse onlyNoteResult(Note note, String query) {
        when(noteRepository.search(any(), any(), any(), any())).thenReturn(new SliceImpl<>(List.of(note)));
        return service.search(student, query, "note", null, 0, 20).groups().get(0).results().get(0);
    }

    @Test
    void 검색어와_유형과_페이지를_검증한다() {
        for (String invalid : new String[]{null, " ", " 가 ", "a".repeat(101)}) {
            assertThatThrownBy(() -> service.search(student, invalid, "all", null, 0, 20))
                    .isInstanceOf(InvalidRequestException.class);
        }
        assertThatThrownBy(() -> service.search(student, "운영", "quiz", null, 0, 20))
                .isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> service.search(student, "운영", "all", null, -1, 20))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void 일치한_블록의_id와_미리보기를_돌려준다() {
        String content = """
                {"type":"doc","content":[
                  {"type":"paragraph","attrs":{"id":"a"},"content":[{"type":"text","text":"다른 내용"}]},
                  {"type":"paragraph","attrs":{"id":"b"},"content":[{"type":"text","text":"JWT 토큰"}]}]}""";

        SearchResultResponse result = onlyNoteResult(note("노트", content, "다른 내용 JWT 토큰"), " jwt ");

        assertThat(result.blockId()).isEqualTo("b");
        assertThat(result.preview()).isEqualTo("JWT 토큰");
    }

    @Test
    void 제목만_일치하거나_본문이_깨지거나_옛블록이어도_결과에_남긴다() {
        String body = "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"JWT\"}]}]}";

        SearchResultResponse titleOnly = onlyNoteResult(note("JWT 정리", "{\"type\":\"doc\",\"content\":[]}", ""), "jwt");
        assertThat(titleOnly.blockId()).isNull();
        assertThat(titleOnly.preview()).isNull();

        SearchResultResponse broken = onlyNoteResult(note("노트", "{깨짐", "JWT 평문"), "jwt");
        assertThat(broken.blockId()).isNull();
        assertThat(broken.preview()).isEqualTo("JWT 평문");

        assertThat(onlyNoteResult(note("노트", null, "JWT"), "jwt").blockId()).isNull();

        SearchResultResponse legacy = onlyNoteResult(note("노트", body, "JWT"), "jwt");
        assertThat(legacy.blockId()).isNull();
        assertThat(legacy.preview()).isEqualTo("JWT");
    }

    @Test
    void 게시글은_익명으로만_표시하고_학번과_실명을_담지_않는다() {
        Post post = new Post();
        post.setPostId(3L);
        post.setCourse(course);
        post.setStudent(student);
        post.setTitle("질문");
        post.setContent("운영체제 과제");
        when(postRepository.search(anyList(), any(), any())).thenReturn(new SliceImpl<>(List.of(post)));

        SearchResultResponse result = service.search(student, "운영", "post", null, 0, 20)
                .groups().get(0).results().get(0);

        assertThat(result.authorName()).isEqualTo("익명 1");
        assertThat(result.toString()).doesNotContain("2021001", "홍길동");
    }

    @Test
    void 전체검색은_유형별_5개로_제한하고_결과없는_유형은_뺀다() {
        Note note = note("JWT", "{}", "");
        Pageable next = PageRequest.of(0, SearchService.ALL_TYPE_LIMIT);
        when(noteRepository.search(eq(1L), eq(null), eq("jwt"), eq(next)))
                .thenReturn(new SliceImpl<>(List.of(note), next, true));

        SearchResponse response = service.search(student, "JWT", "all", null, 3, 50);

        assertThat(response.query()).isEqualTo("JWT");
        assertThat(response.groups()).hasSize(1);
        assertThat(response.groups().get(0).type()).isEqualTo(Type.NOTE);
        assertThat(response.groups().get(0).hasMore()).isTrue();
    }

    @Test
    void 특정유형은_페이지를_적용하고_크기를_50으로_제한한다() {
        service.search(student, "JWT", "note", null, 2, 1000);

        verify(noteRepository).search(1L, null, "jwt", PageRequest.of(2, SearchService.MAX_PAGE_SIZE));
    }

    @Test
    void LIKE_특수문자를_이스케이프한다() {
        service.search(student, "100%_A!b", "note", null, 0, 20);

        verify(noteRepository).search(1L, null, "100!%!_a!!b", PageRequest.of(0, 20));
    }

    @Test
    void 직접만든_강의_필터는_오류없이_노트만_찾는다() {
        when(courseRepository.existsByCourseIdAndUserCreatedTrueAndOwner_StudId(99L, 1L)).thenReturn(true);

        assertThat(service.search(student, "JWT", "all", 99L, 0, 20).groups()).isEmpty();

        verify(noteRepository).search(eq(1L), eq(99L), eq("jwt"), any());
        verify(postRepository, never()).search(anyList(), any(), any());
        verify(sharedNotePostRepository, never()).search(anyList(), any(), any());
        verify(sharedQuizRepository, never()).search(anyList(), any(), any());
    }

    @Test
    void 수강도_소유도_아닌_강의는_거부한다() {
        assertThatThrownBy(() -> service.search(student, "JWT", "all", 99L, 0, 20))
                .isInstanceOf(CourseAccessException.class);
        verify(noteRepository, never()).search(any(), any(), any(), any());
    }

    @Test
    void 수강_강의가_없으면_게시판_쿼리를_실행하지_않는다() {
        when(enrollmentRepository.findByStudent(student)).thenReturn(List.of());

        service.search(student, "JWT", "all", null, 0, 20);

        verify(postRepository, never()).search(anyList(), any(), any());
    }

    @Test
    void 수강_강의_필터는_그_강의로만_찾는다() {
        service.search(student, "JWT", "post", 7L, 0, 20);

        verify(postRepository).search(List.of(7L), "jwt", PageRequest.of(0, 20));
    }
}
