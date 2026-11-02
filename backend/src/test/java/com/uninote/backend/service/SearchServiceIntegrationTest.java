package com.uninote.backend.service;

import com.uninote.backend.domain.Course;
import com.uninote.backend.domain.Enrollment;
import com.uninote.backend.domain.Note;
import com.uninote.backend.domain.Post;
import com.uninote.backend.domain.Question;
import com.uninote.backend.domain.QuizSet;
import com.uninote.backend.domain.SharedNotePost;
import com.uninote.backend.domain.SharedQuiz;
import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.SearchResponse;
import com.uninote.backend.dto.SearchResultResponse;
import com.uninote.backend.dto.SearchResultResponse.Type;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

// 검색 쿼리의 권한 범위는 mock으로 검증할 수 없어 실제 DB에서 확인한다. 트랜잭션은 테스트 뒤 롤백된다.
@SpringBootTest
@Transactional
class SearchServiceIntegrationTest {
    private static final String WORD = "검색통합테스트어";

    @Autowired
    private SearchService searchService;

    @Autowired
    private EntityManager em;

    private Student me;
    private Student other;
    private Course mine;
    private Course notEnrolled;
    private Course myOwn;

    @BeforeEach
    void setUp() {
        me = student();
        other = student();
        mine = course("수강 강의", null);
        notEnrolled = course("다른 강의", null);
        myOwn = course("내가 만든 강의", me);
        Enrollment enrollment = new Enrollment();
        enrollment.setStudent(me);
        enrollment.setCourse(mine);
        em.persist(enrollment);
    }

    private Student student() {
        Student student = new Student();
        student.setStudentNum("t" + UUID.randomUUID());
        student.setName("테스트");
        student.setPassword("x");
        em.persist(student);
        return student;
    }

    private Course course(String name, Student owner) {
        Course course = new Course();
        course.setCourseName(name);
        course.setOwner(owner);
        course.setUserCreated(owner != null);
        em.persist(course);
        return course;
    }

    private void note(Student student, Course course, String title, String searchContent) {
        Note note = new Note();
        note.setStudent(student);
        note.setCourse(course);
        note.setTitle(title);
        note.setContent("{\"type\":\"doc\",\"content\":[]}");
        note.setSearchContent(searchContent);
        em.persist(note);
    }

    private void post(Course course, String title) {
        Post post = new Post();
        post.setStudent(other);
        post.setCourse(course);
        post.setTitle(title);
        post.setContent(WORD + " 본문");
        em.persist(post);
    }

    private void sharedNote(Course course) {
        SharedNotePost post = new SharedNotePost();
        post.setStudent(other);
        post.setCourse(course);
        post.setSourceRootNoteId(System.nanoTime());
        post.setTitle(WORD + " 공유 노트");
        em.persist(post);
    }

    private QuizSet quizSet(Course course, String title, String questionText, String explanation) {
        QuizSet quizSet = new QuizSet();
        quizSet.setCourse(course);
        quizSet.setStudent(other);
        quizSet.setTitle(title);
        em.persist(quizSet);
        Question question = new Question();
        question.setQuizSet(quizSet);
        question.setQuestionText(questionText);
        question.setCorrectAnswer("정답");
        question.setExplanation(explanation);
        em.persist(question);
        return quizSet;
    }

    private void share(QuizSet quizSet, Course course) {
        SharedQuiz shared = new SharedQuiz();
        shared.setQuizSet(quizSet);
        shared.setStudent(other);
        shared.setCourse(course);
        shared.setSourceQuizSetId(System.nanoTime());
        em.persist(shared);
    }

    private List<SearchResultResponse> results(String query, String type, Long courseId) {
        em.flush();
        em.clear();
        SearchResponse response = searchService.search(me, query, type, courseId, 0, 20);
        return response.groups().stream().flatMap(group -> group.results().stream()).toList();
    }

    @Test
    void 내_노트만_찾고_직접만든_강의도_포함한다() {
        note(me, mine, "제목", WORD);
        note(me, myOwn, WORD + " 제목", "");
        note(other, mine, WORD, WORD);

        assertThat(results(WORD, "note", null)).hasSize(2);

        List<SearchResultResponse> own = results(WORD, "all", myOwn.getCourseId());
        assertThat(own).singleElement().satisfies(result -> {
            assertThat(result.type()).isEqualTo(Type.NOTE);
            assertThat(result.courseName()).isEqualTo("내가 만든 강의");
        });
    }

    @Test
    void 수강_강의의_게시글과_공유_노트만_찾는다() {
        post(mine, "보이는 글");
        post(notEnrolled, "안 보이는 글");
        sharedNote(mine);
        sharedNote(notEnrolled);

        assertThat(results(WORD, "post", null)).singleElement().satisfies(result -> {
            assertThat(result.title()).isEqualTo("보이는 글");
            assertThat(result.preview()).contains(WORD);
            assertThat(result.authorName()).startsWith("익명");
        });
        assertThat(results(WORD, "shared_note", null)).hasSize(1);
    }

    @Test
    void 공유된_시험만_찾고_문항_미리보기를_한건으로_돌려준다() {
        QuizSet shared = quizSet(mine, "운영체제 시험", WORD + " 문제", null);
        Question second = new Question();
        second.setQuizSet(shared);
        second.setQuestionText(WORD + " 두 번째 문제");
        second.setCorrectAnswer("정답");
        em.persist(second);
        share(shared, mine);
        quizSet(mine, "공유 안 한 퀴즈", WORD + " 비공개 문제", null);
        share(quizSet(notEnrolled, "다른 강의 시험", WORD + " 문제", null), notEnrolled);

        assertThat(results(WORD, "shared_quiz", null)).singleElement().satisfies(result -> {
            assertThat(result.title()).isEqualTo("운영체제 시험");
            assertThat(result.preview()).isEqualTo(WORD + " 문제");
        });
    }

    @Test
    void 공유_시험은_제목으로_찾을수_있고_해설로는_찾지_않는다() {
        share(quizSet(mine, WORD + " 시험", "문제", null), mine);
        share(quizSet(mine, "다른 시험", "문제", WORD + " 해설"), mine);

        assertThat(results(WORD, "shared_quiz", null)).singleElement()
                .satisfies(result -> assertThat(result.title()).isEqualTo(WORD + " 시험"));
    }

    @Test
    void LIKE_특수문자는_문자_그대로_찾는다() {
        note(me, mine, "진도 100% 달성", "");
        note(me, mine, "진도 1000 달성", "");

        assertThat(results("100%", "note", null)).singleElement()
                .satisfies(result -> assertThat(result.title()).isEqualTo("진도 100% 달성"));
    }
}
