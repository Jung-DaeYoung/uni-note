package com.uninote.backend.service;

import com.uninote.backend.domain.Course;
import com.uninote.backend.domain.Enrollment;
import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.MyPageResponse;
import com.uninote.backend.repository.CourseRepository;
import com.uninote.backend.repository.EnrollmentRepository;
import com.uninote.backend.repository.MyPageActivityRepository;
import com.uninote.backend.repository.NoteRepository;
import com.uninote.backend.repository.StudentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.data.domain.PageRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MyPageServiceTest {

    private final StudentRepository studentRepository = mock(StudentRepository.class);
    private final MyPageActivityRepository activityRepository = mock(MyPageActivityRepository.class);
    // 2026-10-14 10:00 KST (= 01:00 UTC). 시스템 기본 시간대가 UTC여도 서울 기준 날짜로 학기를 정해야 한다.
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-14T01:00:00Z"), ZoneId.of("UTC"));
    private final EnrollmentRepository enrollmentRepository = mock(EnrollmentRepository.class);
    private final CourseRepository courseRepository = mock(CourseRepository.class);
    private final NoteRepository noteRepository = mock(NoteRepository.class);
    private final MyPageService service = new MyPageService(studentRepository, activityRepository,
            enrollmentRepository, courseRepository, noteRepository, clock);

    private Student student;

    @BeforeEach
    void setUp() {
        student = new Student();
        student.setStudId(1L);
        student.setStudentNum("2021001");
        student.setName("홍길동");
        when(studentRepository.getByStudentNum("2021001")).thenReturn(student);
    }

    @ParameterizedTest
    @CsvSource({
            "2026-02-28, 2025년 2학기, 2025-09-01, 2025-12-31",
            "2026-01-01, 2025년 2학기, 2025-09-01, 2025-12-31",
            "2026-03-01, 2026년 1학기, 2026-03-01, 2026-06-30",
            "2026-06-30, 2026년 1학기, 2026-03-01, 2026-06-30",
            "2026-07-01, 2026년 1학기, 2026-03-01, 2026-06-30",
            "2026-08-31, 2026년 1학기, 2026-03-01, 2026-06-30",
            "2026-09-01, 2026년 2학기, 2026-09-01, 2026-12-31",
            "2026-12-31, 2026년 2학기, 2026-09-01, 2026-12-31",
    })
    void semesterBoundaries(LocalDate today, String label, LocalDate start, LocalDate end) {
        assertThat(MyPageService.semesterOf(today))
                .isEqualTo(new MyPageResponse.Semester(label, start, end));
    }

    @Test
    void emptyDataReturnsProfileZeroSummaryAndEmptyHeatmap() {
        MyPageResponse res = service.getMyPage("2021001");

        assertThat(res.profile()).isEqualTo(new MyPageResponse.Profile("홍길동", "2021001"));
        assertThat(res.semester().label()).isEqualTo("2026년 2학기");
        assertThat(res.summary()).isEqualTo(new MyPageResponse.Summary(0, 0, 0, 0, 0, 0, 0));
        assertThat(res.heatmap()).isEmpty();
        assertThat(res.courseProgress()).isEmpty();
        assertThat(res.recentActivities()).isEmpty();
        assertThat(res.myContents()).isEqualTo(new MyPageResponse.MyContents(List.of(), List.of(), List.of(), List.of()));
    }

    @Test
    void queriesUseAuthenticatedStudentAndSemesterRange() {
        service.getMyPage("2021001");

        verify(activityRepository).findAttemptTimes(student,
                LocalDateTime.of(2026, 9, 1, 0, 0), LocalDateTime.of(2027, 1, 1, 0, 0));
        verify(activityRepository).countNotes(student);
    }

    @Test
    void heatmapMergesSourcesByDate() {
        LocalDateTime day1 = LocalDateTime.of(2026, 9, 3, 10, 0);
        LocalDateTime day2 = LocalDateTime.of(2026, 9, 5, 23, 59);
        when(activityRepository.findPostTimes(eq(student), any(), any())).thenReturn(List.of(day1));
        when(activityRepository.findAttemptTimes(eq(student), any(), any())).thenReturn(List.of(day1.plusHours(2), day2));
        when(activityRepository.findSharedQuizCommentTimes(eq(student), any(), any())).thenReturn(List.of(day2));

        assertThat(service.getMyPage("2021001").heatmap()).containsExactly(
                new MyPageResponse.HeatmapDay(LocalDate.of(2026, 9, 3), 2),
                new MyPageResponse.HeatmapDay(LocalDate.of(2026, 9, 5), 2));
    }

    @Test
    void noteCountsCreationOnceAndLastUpdateOnlyOnDifferentDay() {
        LocalDateTime created = LocalDateTime.of(2026, 9, 10, 9, 0);
        when(activityRepository.findNoteTimes(eq(student), any(), any())).thenReturn(List.of(
                // 같은 날 생성·수정: 1회
                new Object[]{created, created.plusHours(3)},
                // 생성 후 다른 날 수정: 생성일 1회 + 수정일 1회
                new Object[]{created, LocalDateTime.of(2026, 9, 12, 20, 0)},
                // 학기 전에 생성, 학기 중 수정: 수정일만 1회
                new Object[]{LocalDateTime.of(2026, 8, 20, 9, 0), LocalDateTime.of(2026, 9, 12, 8, 0)}));

        assertThat(service.getMyPage("2021001").heatmap()).containsExactly(
                new MyPageResponse.HeatmapDay(LocalDate.of(2026, 9, 10), 2),
                new MyPageResponse.HeatmapDay(LocalDate.of(2026, 9, 12), 2));
    }

    @Test
    void summarySumsCommentsAndSharesAcrossBoards() {
        when(activityRepository.countNotes(student)).thenReturn(5L);
        when(activityRepository.countComments(student)).thenReturn(1L);
        when(activityRepository.countSharedNoteComments(student)).thenReturn(2L);
        when(activityRepository.countSharedQuizComments(student)).thenReturn(3L);
        when(activityRepository.countSharedNotes(student)).thenReturn(4L);
        when(activityRepository.countSharedQuizzes(student)).thenReturn(1L);

        MyPageResponse.Summary summary = service.getMyPage("2021001").summary();

        assertThat(summary.noteCount()).isEqualTo(5);
        assertThat(summary.commentCount()).isEqualTo(6);
        assertThat(summary.sharedCount()).isEqualTo(5);
    }

    @Test
    void courseProgressIncludesOwnedCoursesAndZeroForInactiveCourses() {
        Course enrolled = course(10L, "운영체제");
        Course owned = course(20L, "내 스터디");
        Enrollment enrollment = new Enrollment();
        enrollment.setCourse(enrolled);
        when(enrollmentRepository.findByStudent(student)).thenReturn(List.of(enrollment));
        when(courseRepository.findByOwner_StudIdAndUserCreatedTrueOrderByCourseIdAsc(1L)).thenReturn(List.of(owned));
        LocalDateTime noteAt = LocalDateTime.of(2026, 10, 1, 9, 0);
        LocalDateTime attemptAt = LocalDateTime.of(2026, 10, 3, 9, 0);
        when(activityRepository.countNotesByCourse(student)).thenReturn(rows(new Object[]{10L, 3L, noteAt}));
        when(activityRepository.countAttemptsByCourse(student)).thenReturn(rows(new Object[]{10L, 2L, attemptAt}));

        assertThat(service.getMyPage("2021001").courseProgress()).containsExactly(
                new MyPageResponse.CourseProgress(10L, "운영체제", 3, 0, 2, attemptAt),
                new MyPageResponse.CourseProgress(20L, "내 스터디", 0, 0, 0, null));
    }

    @Test
    void recentActivitiesMergeSourcesNewestFirstAndKeepTwenty() {
        LocalDateTime base = LocalDateTime.of(2026, 10, 1, 0, 0);
        List<Object[]> notes = new ArrayList<>();
        for (int i = 0; i < 20; i++) notes.add(new Object[]{"노트" + i, base.plusHours(i), 1L, (long) i});
        when(activityRepository.findRecentNoteCreations(eq(student), any())).thenReturn(notes);
        when(activityRepository.findRecentIncorrectItems(eq(student), any())).thenReturn(rows(
                new Object[]{"가".repeat(50), base.plusDays(5), 1L, 99L}));

        List<MyPageResponse.Activity> activities = service.getMyPage("2021001").recentActivities();

        assertThat(activities).hasSize(20);
        assertThat(activities.get(0)).isEqualTo(new MyPageResponse.Activity(
                "INCORRECT_NOTE_ADDED", "가".repeat(40) + "…", base.plusDays(5), 1L, 99L));
        assertThat(activities.get(1).title()).isEqualTo("노트19");
        // 가장 오래된 노트0은 20건 제한으로 빠진다.
        assertThat(activities).extracting(MyPageResponse.Activity::title).doesNotContain("노트0");
    }

    @Test
    void myContentsMapsQuizAndSharedRows() {
        LocalDateTime at = LocalDateTime.of(2026, 10, 2, 9, 0);
        when(activityRepository.findRecentQuizSets(student, PageRequest.of(0, 6))).thenReturn(rows(new Object[]{"내 퀴즈", at, 1L, 7L}));
        when(activityRepository.findRecentSharedNotes(eq(student), any())).thenReturn(rows(new Object[]{"공유 노트", at, 1L, 3L}));
        when(activityRepository.findRecentSharedQuizzes(eq(student), any())).thenReturn(rows(new Object[]{"공유 시험", at, 1L, 5L}));

        MyPageResponse.MyContents contents = service.getMyPage("2021001").myContents();

        assertThat(contents.recentQuizzes()).containsExactly(new MyPageResponse.RecentQuiz(7L, "내 퀴즈", at));
        assertThat(contents.sharedNotes()).containsExactly(new MyPageResponse.SharedNote(3L, "공유 노트", at));
        assertThat(contents.sharedQuizzes()).containsExactly(new MyPageResponse.SharedQuizItem(5L, "공유 시험", at));
    }

    private static Course course(Long id, String name) {
        Course course = new Course();
        course.setCourseId(id);
        course.setCourseName(name);
        return course;
    }

    private static List<Object[]> rows(Object[]... rows) {
        return List.of(rows);
    }
}
