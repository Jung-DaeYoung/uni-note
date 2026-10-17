package com.uninote.backend.service;

import com.uninote.backend.domain.Enrollment;
import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.MyPageResponse;
import com.uninote.backend.repository.CourseRepository;
import com.uninote.backend.repository.EnrollmentRepository;
import com.uninote.backend.repository.MyPageActivityRepository;
import com.uninote.backend.repository.NoteRepository;
import com.uninote.backend.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MyPageService {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final int RECENT_ACTIVITY_LIMIT = 20;
    private static final int TITLE_PREVIEW_LENGTH = 40;

    private final StudentRepository studentRepository;
    private final MyPageActivityRepository activityRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CourseRepository courseRepository;
    private final NoteRepository noteRepository;
    private final Clock clock;

    public MyPageResponse getMyPage(String studentNum) {
        Student student = studentRepository.getByStudentNum(studentNum);
        MyPageResponse.Semester semester = semesterOf(LocalDate.now(clock.withZone(SEOUL)));

        return new MyPageResponse(
                new MyPageResponse.Profile(student.getName(), student.getStudentNum()),
                semester,
                summaryOf(student),
                heatmapOf(student, semester),
                courseProgressOf(student),
                recentActivitiesOf(student),
                myContentsOf(student));
    }

    // 학기 엔티티가 없으므로 달력 규칙으로 정한다. 1학기 3/1~6/30, 2학기 9/1~12/31.
    // 방학에는 직전 학기를 보여준다(7~8월은 그해 1학기, 1~2월은 전년도 2학기).
    static MyPageResponse.Semester semesterOf(LocalDate today) {
        int month = today.getMonthValue();
        if (month >= 3 && month <= 8) {
            int year = today.getYear();
            return new MyPageResponse.Semester(year + "년 1학기", LocalDate.of(year, 3, 1), LocalDate.of(year, 6, 30));
        }
        int year = month <= 2 ? today.getYear() - 1 : today.getYear();
        return new MyPageResponse.Semester(year + "년 2학기", LocalDate.of(year, 9, 1), LocalDate.of(year, 12, 31));
    }

    private MyPageResponse.Summary summaryOf(Student student) {
        return new MyPageResponse.Summary(
                activityRepository.countNotes(student),
                activityRepository.countQuizSets(student),
                activityRepository.countAttempts(student),
                activityRepository.countIncorrectItems(student),
                activityRepository.countPosts(student),
                activityRepository.countComments(student)
                        + activityRepository.countSharedNoteComments(student)
                        + activityRepository.countSharedQuizComments(student),
                activityRepository.countSharedNotes(student) + activityRepository.countSharedQuizzes(student));
    }

    private List<MyPageResponse.HeatmapDay> heatmapOf(Student student, MyPageResponse.Semester semester) {
        LocalDateTime from = semester.startDate().atStartOfDay();
        LocalDateTime to = semester.endDate().plusDays(1).atStartOfDay();
        Map<LocalDate, Long> counts = new TreeMap<>();

        Stream.of(
                        activityRepository.findPostTimes(student, from, to),
                        activityRepository.findCommentTimes(student, from, to),
                        activityRepository.findSharedNoteCommentTimes(student, from, to),
                        activityRepository.findSharedQuizCommentTimes(student, from, to),
                        activityRepository.findQuizSetTimes(student, from, to),
                        activityRepository.findAttemptTimes(student, from, to),
                        activityRepository.findIncorrectItemTimes(student, from, to),
                        activityRepository.findSharedNoteTimes(student, from, to),
                        activityRepository.findSharedQuizTimes(student, from, to))
                .flatMap(List::stream)
                .forEach(time -> counts.merge(time.toLocalDate(), 1L, Long::sum));

        // 노트 1개는 생성일에 1회, 마지막 수정일이 생성일과 다른 날이면 그날 1회를 더 센다.
        // updatedAt은 @UpdateTimestamp라 수정 이력이 누적되지 않고 마지막 날만 남는다.
        for (Object[] row : activityRepository.findNoteTimes(student, from, to)) {
            LocalDateTime createdAt = (LocalDateTime) row[0];
            LocalDateTime updatedAt = (LocalDateTime) row[1];
            if (createdAt != null && inRange(createdAt, from, to)) {
                counts.merge(createdAt.toLocalDate(), 1L, Long::sum);
            }
            if (updatedAt != null && inRange(updatedAt, from, to)
                    && (createdAt == null || !updatedAt.toLocalDate().equals(createdAt.toLocalDate()))) {
                counts.merge(updatedAt.toLocalDate(), 1L, Long::sum);
            }
        }

        return counts.entrySet().stream()
                .map(e -> new MyPageResponse.HeatmapDay(e.getKey(), e.getValue()))
                .toList();
    }

    private static boolean inRange(LocalDateTime time, LocalDateTime from, LocalDateTime to) {
        return !time.isBefore(from) && time.isBefore(to);
    }

    // 강의 목록은 대시보드와 같다: 수강 강의 다음에 직접 만든 강의(소유자에게는 Enrollment가 없다).
    private List<MyPageResponse.CourseProgress> courseProgressOf(Student student) {
        Map<Long, Object[]> notes = byCourse(activityRepository.countNotesByCourse(student));
        Map<Long, Object[]> quizSets = byCourse(activityRepository.countQuizSetsByCourse(student));
        Map<Long, Object[]> attempts = byCourse(activityRepository.countAttemptsByCourse(student));

        return Stream.concat(
                        enrollmentRepository.findByStudent(student).stream().map(Enrollment::getCourse),
                        courseRepository.findByOwner_StudIdAndUserCreatedTrueOrderByCourseIdAsc(student.getStudId()).stream())
                .map(course -> {
                    Long id = course.getCourseId();
                    return new MyPageResponse.CourseProgress(id, course.getCourseName(),
                            countOf(notes.get(id)), countOf(quizSets.get(id)), countOf(attempts.get(id)),
                            Stream.of(notes.get(id), quizSets.get(id), attempts.get(id))
                                    .filter(Objects::nonNull)
                                    .map(row -> (LocalDateTime) row[2])
                                    .filter(Objects::nonNull)
                                    .max(Comparator.naturalOrder())
                                    .orElse(null));
                })
                .toList();
    }

    // 원천마다 최신 20건을 받아 합친 뒤 최신순으로 20건만 남긴다.
    private List<MyPageResponse.Activity> recentActivitiesOf(Student student) {
        Pageable top = PageRequest.of(0, RECENT_ACTIVITY_LIMIT);
        return Stream.of(
                        activities("NOTE_CREATED", activityRepository.findRecentNoteCreations(student, top)),
                        activities("NOTE_UPDATED", activityRepository.findRecentNoteUpdates(student, top)),
                        activities("POST_CREATED", activityRepository.findRecentPosts(student, top)),
                        activities("COMMENT_CREATED", activityRepository.findRecentComments(student, top)),
                        activities("SHARED_NOTE_COMMENTED", activityRepository.findRecentSharedNoteComments(student, top)),
                        activities("SHARED_QUIZ_COMMENTED", activityRepository.findRecentSharedQuizComments(student, top)),
                        activities("QUIZ_GENERATED", activityRepository.findRecentQuizSets(student, top)),
                        activities("QUIZ_ATTEMPTED", activityRepository.findRecentAttempts(student, top)),
                        activities("INCORRECT_NOTE_ADDED", activityRepository.findRecentIncorrectItems(student, top)),
                        activities("NOTE_SHARED", activityRepository.findRecentSharedNotes(student, top)),
                        activities("QUIZ_SHARED", activityRepository.findRecentSharedQuizzes(student, top)))
                .flatMap(s -> s)
                .sorted(Comparator.comparing(MyPageResponse.Activity::occurredAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(RECENT_ACTIVITY_LIMIT)
                .toList();
    }

    private MyPageResponse.MyContents myContentsOf(Student student) {
        Pageable top = PageRequest.of(0, RECENT_ACTIVITY_LIMIT);
        return new MyPageResponse.MyContents(
                noteRepository.findTop6ByStudentOrderByUpdatedAtDesc(student).stream()
                        .map(n -> new MyPageResponse.RecentNote(n.getNoteId(),
                                n.getCourse() != null ? n.getCourse().getCourseId() : null, n.getTitle(), n.getUpdatedAt()))
                        .toList(),
                activityRepository.findRecentSharedNotes(student, top).stream()
                        .map(r -> new MyPageResponse.SharedNote((Long) r[3], (String) r[0], (LocalDateTime) r[1]))
                        .toList(),
                activityRepository.findRecentSharedQuizzes(student, top).stream()
                        .map(r -> new MyPageResponse.SharedQuizItem((Long) r[3], (String) r[0], (LocalDateTime) r[1]))
                        .toList());
    }

    // 행 형식: [title, occurredAt, courseId, targetId]. 오답 문제 텍스트처럼 긴 제목은 앞부분만 보낸다.
    private static Stream<MyPageResponse.Activity> activities(String type, List<Object[]> rows) {
        return rows.stream().map(r -> new MyPageResponse.Activity(type, preview((String) r[0]),
                (LocalDateTime) r[1], (Long) r[2], (Long) r[3]));
    }

    static String preview(String title) {
        return title != null && title.length() > TITLE_PREVIEW_LENGTH
                ? title.substring(0, TITLE_PREVIEW_LENGTH) + "…" : title;
    }

    // 행 형식: [courseId, count, MAX(시각)]
    private static Map<Long, Object[]> byCourse(List<Object[]> rows) {
        return rows.stream().collect(Collectors.toMap(r -> (Long) r[0], r -> r));
    }

    private static long countOf(Object[] row) {
        return row == null ? 0 : (Long) row[1];
    }
}
