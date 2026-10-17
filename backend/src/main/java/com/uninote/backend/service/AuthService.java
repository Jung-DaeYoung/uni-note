package com.uninote.backend.service;

import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.LoginRequest;
import com.uninote.backend.exception.TooManyRequestsException;
import com.uninote.backend.repository.StudentRepository;
import com.uninote.backend.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    // 학번이 없든 비밀번호가 틀리든 같은 메시지를 보내 계정 존재 여부를 드러내지 않는다(상태 코드도 401로 같다).
    static final String LOGIN_FAILED_MESSAGE = "학번 또는 비밀번호가 올바르지 않습니다.";

    // 같은 학번으로 LOGIN_WINDOW 안에 MAX_FAILED_LOGINS번 실패하면, 가장 오래된 실패가 창을 벗어날 때까지 막는다.
    // ponytail: 서버 메모리 기준이라 재시작하면 초기화되고 다중 서버에서 공유되지 않는다(PLANS.md P1-2와 함께 이전).
    static final int MAX_FAILED_LOGINS = 5;
    static final Duration LOGIN_WINDOW = Duration.ofMinutes(15);
    // 임의 학번을 계속 보내 메모리를 키우지 못하게, 추적 수가 이보다 많으면 만료된 기록을 정리한다.
    static final int MAX_TRACKED_STUDENT_NUMS = 10_000;

    private final StudentRepository studentRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    private final Map<String, Deque<Instant>> failedLogins = new ConcurrentHashMap<>();
    // 없는 학번에도 BCrypt 비교를 한 번 해서, 응답 시간으로 계정 존재 여부를 짐작하지 못하게 한다.
    private volatile String dummyHash;

    public String login(LoginRequest loginRequest) {
        String studentNum = loginRequest.getStudentNum() == null ? "" : loginRequest.getStudentNum().trim();
        log.info("로그인 시도 - 학번: {}", studentNum);
        checkNotLocked(studentNum);

        String rawPassword = loginRequest.getPassword() != null ? loginRequest.getPassword().trim() : "";
        Optional<Student> found = studentRepository.findByStudentNum(studentNum);
        if (found.isEmpty()) {
            passwordEncoder.matches(rawPassword, dummyHash());
            log.error("로그인 실패: 해당 학번({})의 학생이 존재하지 않습니다.", studentNum);
            throw loginFailed(studentNum);
        }
        Student student = found.get();
        String storedPassword = student.getPassword() != null ? student.getPassword().trim() : "";

        boolean passwordMatches;
        if (isBcryptHash(storedPassword)) {
            passwordMatches = passwordEncoder.matches(rawPassword, storedPassword);
        } else {
            // 아직 해시로 전환되지 않은 레거시 평문 비밀번호와의 호환 처리.
            // 값이 일치하면 로그인은 허용하되, 그 즉시 BCrypt 해시로 다시 저장해
            // 다음 로그인부터는 평문 비교 경로를 타지 않도록 한다.
            // (별도 일괄 마이그레이션 배치 없이, 로그인 시점에 계정별로 점진 전환)
            passwordMatches = !storedPassword.isEmpty() && rawPassword.equals(storedPassword);
            if (passwordMatches) {
                student.setPassword(passwordEncoder.encode(rawPassword));
                studentRepository.save(student);
                log.info("레거시 평문 비밀번호를 해시로 전환했습니다 - 학번: {}", studentNum);
            }
        }

        if (!passwordMatches) {
            log.error("로그인 실패: 비밀번호가 일치하지 않습니다. 학번: {}", studentNum);
            throw loginFailed(studentNum);
        }

        failedLogins.remove(studentNum);
        log.info("로그인 성공 - 학번: {}", studentNum);
        return jwtUtil.generateToken(student.getStudentNum());
    }

    private void checkNotLocked(String studentNum) {
        Deque<Instant> failures = failedLogins.get(studentNum);
        if (failures == null) return;
        synchronized (failures) {
            Instant windowStart = clock.instant().minus(LOGIN_WINDOW);
            while (!failures.isEmpty() && !failures.peekFirst().isAfter(windowStart)) {
                failures.pollFirst();
            }
            if (failures.size() >= MAX_FAILED_LOGINS) {
                long waitSeconds = Duration.between(windowStart, failures.peekFirst()).toSeconds();
                long waitMinutes = Math.max(1, (waitSeconds + 59) / 60);
                log.warn("로그인 제한 - 학번: {}", studentNum);
                throw new TooManyRequestsException(String.format(
                        "로그인 시도가 너무 많습니다. %d분 후 다시 시도해 주세요.", waitMinutes));
            }
        }
    }

    // 실패를 기록하고, 원인과 무관한 같은 예외를 돌려준다.
    private IllegalArgumentException loginFailed(String studentNum) {
        if (failedLogins.size() > MAX_TRACKED_STUDENT_NUMS) {
            Instant windowStart = clock.instant().minus(LOGIN_WINDOW);
            failedLogins.values().removeIf(failures -> {
                synchronized (failures) {
                    return failures.isEmpty() || !failures.peekLast().isAfter(windowStart);
                }
            });
        }
        Deque<Instant> failures = failedLogins.computeIfAbsent(studentNum, k -> new ArrayDeque<>());
        synchronized (failures) {
            failures.addLast(clock.instant());
        }
        return new IllegalArgumentException(LOGIN_FAILED_MESSAGE);
    }

    private String dummyHash() {
        if (dummyHash == null) {
            dummyHash = passwordEncoder.encode("dummy-password-for-timing");
        }
        return dummyHash;
    }

    private boolean isBcryptHash(String value) {
        return value != null && (value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$"));
    }
}
