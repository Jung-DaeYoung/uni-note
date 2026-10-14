package com.uninote.backend.service;

import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.MyPageResponse;
import com.uninote.backend.repository.MyPageActivityRepository;
import com.uninote.backend.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MyPageService {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    private final StudentRepository studentRepository;
    private final MyPageActivityRepository activityRepository;
    private final Clock clock;

    public MyPageResponse getMyPage(String studentNum) {
        Student student = studentRepository.getByStudentNum(studentNum);
        MyPageResponse.Semester semester = semesterOf(LocalDate.now(clock.withZone(SEOUL)));

        return new MyPageResponse(
                new MyPageResponse.Profile(student.getName(), student.getStudentNum()),
                semester,
                summaryOf(student),
                heatmapOf(student, semester));
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
}
