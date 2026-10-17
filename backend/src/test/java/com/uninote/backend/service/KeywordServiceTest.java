package com.uninote.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uninote.backend.domain.Note;
import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.KeywordExplainRequest;
import com.uninote.backend.dto.KeywordExplainResponse;
import com.uninote.backend.dto.KeywordMentionResponse;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.exception.ExternalServiceException;
import com.uninote.backend.exception.InvalidRequestException;
import com.uninote.backend.repository.NoteRepository;
import com.uninote.backend.exception.TooManyRequestsException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class KeywordServiceTest {

    private static final String VALID_JSON = """
            {"summary":"요약","easyExplanation":"쉬운 설명","advancedExplanation":"심화 설명",
             "relatedKeywords":["OAuth"],"resources":[]}""";

    private final GeminiClient geminiClient = mock(GeminiClient.class);
    private final NoteService noteService = mock(NoteService.class);
    private final NoteRepository noteRepository = mock(NoteRepository.class);
    private final Clock clock = mock(Clock.class);
    private final KeywordService keywordService =
            new KeywordService(geminiClient, noteService, noteRepository, new ObjectMapper(), clock);

    private Student student;

    @BeforeEach
    void setUp() {
        student = new Student();
        student.setStudId(1L);
        student.setStudentNum("2021001");
        when(clock.instant()).thenReturn(Instant.EPOCH);
    }

    private KeywordExplainRequest request(String keyword, String context, Long noteId) {
        KeywordExplainRequest request = new KeywordExplainRequest();
        request.setKeyword(keyword);
        request.setContext(context);
        request.setNoteId(noteId);
        return request;
    }

    @Test
    void explainReturnsAiExplanationWithTrimmedKeywordAndContextInPrompt() {
        when(geminiClient.generateJson(any(), any(), anyString())).thenReturn(VALID_JSON);

        KeywordExplainResponse response = keywordService.explain(request(" JWT ", "JWT는 토큰이다.", null), student);

        assertThat(response.keyword()).isEqualTo("JWT");
        assertThat(response.summary()).isEqualTo("요약");
        assertThat(response.relatedKeywords()).containsExactly("OAuth");
        verify(geminiClient).generateJson(argThat(parts -> {
            String prompt = (String) parts.get(0).get("text");
            return prompt.contains("키워드: JWT\n") && prompt.contains("\"\"\"\nJWT는 토큰이다.\n\"\"\"");
        }), any(), anyString());
    }

    @Test
    void explainChecksNoteOwnershipBeforeCallingAi() {
        when(noteService.getNote(eq(10L), eq("2021001"))).thenThrow(new CourseAccessException("본인 노트만 접근할 수 있습니다."));

        assertThatThrownBy(() -> keywordService.explain(request("JWT", null, 10L), student))
                .isInstanceOf(CourseAccessException.class);
        verify(geminiClient, never()).generateJson(any(), any(), anyString());
    }

    @Test
    void explainIsRateLimitedPerStudent() {
        when(geminiClient.generateJson(any(), any(), anyString())).thenReturn(VALID_JSON);
        for (int i = 0; i < KeywordService.MAX_EXPLAINS_PER_WINDOW; i++) {
            keywordService.explain(request("JWT", null, null), student);
        }

        assertThatThrownBy(() -> keywordService.explain(request("JWT", null, null), student))
                .isInstanceOf(TooManyRequestsException.class);

        Student other = new Student();
        other.setStudId(2L);
        other.setStudentNum("2021002");
        keywordService.explain(request("JWT", null, null), other);
    }

    @Test
    void explainFailsWhenAnyExplanationIsBlank() {
        when(geminiClient.generateJson(any(), any(), anyString())).thenReturn("""
                {"summary":"요약","easyExplanation":" ","advancedExplanation":"심화","relatedKeywords":[],"resources":[]}""");

        assertThatThrownBy(() -> keywordService.explain(request("JWT", null, null), student))
                .isInstanceOf(ExternalServiceException.class)
                .extracting("errorCode").isEqualTo(ExternalServiceException.AI_RESPONSE_INVALID);
    }

    @Test
    void explainFailsWhenAiJsonIsMalformed() {
        when(geminiClient.generateJson(any(), any(), anyString())).thenReturn("{not json");

        assertThatThrownBy(() -> keywordService.explain(request("JWT", null, null), student))
                .isInstanceOf(ExternalServiceException.class)
                .extracting("errorCode").isEqualTo(ExternalServiceException.AI_RESPONSE_INVALID);
    }

    @Test
    void toResponseCleansRelatedKeywordsAndBuildsOnlyAllowlistedSearchLinks() {
        KeywordService.AiExplanation ai = new KeywordService.AiExplanation("요약", "쉬움", "x".repeat(4000),
                List.of(" jwt ", "OAuth", "oauth", " ", "a".repeat(31), "HMAC", "Bearer   Token", "세션", "쿠키", "CSRF"),
                List.of(
                        new KeywordService.AiResource("JSON Web Token", "WIKIPEDIA_EN", " 표준 설명 "),
                        new KeywordService.AiResource("JWT", "EVIL_SITE", "허용 목록 밖"),
                        new KeywordService.AiResource("  ", "MDN", "빈 검색어"),
                        new KeywordService.AiResource("토큰 & 인증", "WIKIPEDIA_KO", "한국어 문서"),
                        new KeywordService.AiResource("JWT security", "SCHOLAR", "논문"),
                        new KeywordService.AiResource("JWT", "MDN", "네 번째라 버림")));

        KeywordExplainResponse response = KeywordService.toResponse("JWT", ai);

        assertThat(response.advancedExplanation()).hasSize(KeywordService.MAX_EXPLANATION_LENGTH);
        // 키워드 자신·중복·빈 값·30자 초과를 빼고 최대 5개
        assertThat(response.relatedKeywords()).containsExactly("OAuth", "HMAC", "Bearer Token", "세션", "쿠키");
        assertThat(response.resources()).extracting(KeywordExplainResponse.Resource::url).containsExactly(
                "https://en.wikipedia.org/w/index.php?search=JSON+Web+Token",
                "https://ko.wikipedia.org/w/index.php?search=%ED%86%A0%ED%81%B0+%26+%EC%9D%B8%EC%A6%9D",
                "https://scholar.google.com/scholar?q=JWT+security");
        assertThat(response.resources().get(0).source()).isEqualTo("en.wikipedia.org");
        assertThat(response.resources().get(0).reason()).isEqualTo("표준 설명");
    }

    private static Note note(long noteId, String title, String content) {
        Note note = new Note();
        note.setNoteId(noteId);
        note.setTitle(title);
        note.setContent(content);
        return note;
    }

    private static String paragraph(String id, String text) {
        String attrs = id == null ? "{}" : "{\"id\":\"" + id + "\"}";
        return "{\"type\":\"paragraph\",\"attrs\":" + attrs + ",\"content\":[{\"type\":\"text\",\"text\":\"" + text + "\"}]}";
    }

    private static String doc(String... blocks) {
        return "{\"type\":\"doc\",\"content\":[" + String.join(",", blocks) + "]}";
    }

    @Test
    void findMentionsReturnsMatchingTopLevelBlocksWithPreview() {
        String longText = "가".repeat(50) + " jwt 검증 " + "나".repeat(50);
        when(noteRepository.searchByContent(1L, 7L, "jwt", PageRequest.of(0, KeywordService.MAX_MENTIONS)))
                .thenReturn(List.of(
                        note(10L, "보안", doc(paragraph("p1", "세션 설명"), paragraph("p2", "JWT는   토큰이다"), paragraph(null, "옛 블록의 JWT"))),
                        note(11L, "깨진 노트", "{not json"),
                        note(12L, "긴 노트", doc(paragraph("q1", longText)))));

        List<KeywordMentionResponse> mentions = keywordService.findMentions(student, " JWT ", 7L);

        assertThat(mentions).containsExactly(
                new KeywordMentionResponse(10L, "보안", "p2", "JWT는 토큰이다"),
                new KeywordMentionResponse(10L, "보안", null, "옛 블록의 JWT"),
                new KeywordMentionResponse(12L, "긴 노트", "q1", "…" + "가".repeat(39) + " jwt 검증 " + "나".repeat(36) + "…"));
    }

    @Test
    void findMentionsStopsAtMaxAndEscapesLikePattern() {
        String[] blocks = new String[12];
        for (int i = 0; i < blocks.length; i++) blocks[i] = paragraph("b" + i, "100%_a!b");
        when(noteRepository.searchByContent(eq(1L), eq(7L), eq("100!%!_a!!b"), any()))
                .thenReturn(List.of(note(10L, "노트", doc(blocks))));

        assertThat(keywordService.findMentions(student, "100%_A!b", 7L)).hasSize(KeywordService.MAX_MENTIONS);
    }

    @Test
    void findMentionsRejectsBlankOrTooLongKeywordAndMissingCourse() {
        assertThatThrownBy(() -> keywordService.findMentions(student, " ", 7L)).isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> keywordService.findMentions(student, "a".repeat(81), 7L)).isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> keywordService.findMentions(student, "JWT", null)).isInstanceOf(InvalidRequestException.class);
        verify(noteRepository, never()).searchByContent(any(), any(), anyString(), any());
    }
}
