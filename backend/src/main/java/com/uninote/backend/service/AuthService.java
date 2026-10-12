package com.uninote.backend.service;

import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.LoginRequest;
import com.uninote.backend.repository.StudentRepository;
import com.uninote.backend.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final StudentRepository studentRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    public String login(LoginRequest loginRequest) {
        log.info("로그인 시도 - 학번: {}", loginRequest.getStudentNum());

        Student student = studentRepository.findByStudentNum(loginRequest.getStudentNum())
                .orElseThrow(() -> {
                    log.error("로그인 실패: 해당 학번({})의 학생이 존재하지 않습니다.", loginRequest.getStudentNum());
                    return new IllegalArgumentException("해당 학번의 학생을 찾을 수 없습니다.");
                });

        String rawPassword = loginRequest.getPassword() != null ? loginRequest.getPassword().trim() : "";
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
                log.info("레거시 평문 비밀번호를 해시로 전환했습니다 - 학번: {}", loginRequest.getStudentNum());
            }
        }

        if (!passwordMatches) {
            log.error("로그인 실패: 비밀번호가 일치하지 않습니다. 학번: {}", loginRequest.getStudentNum());
            throw new IllegalArgumentException("비밀번호가 일치하지 않습니다.");
        }

        log.info("로그인 성공 - 학번: {}", loginRequest.getStudentNum());
        return jwtUtil.generateToken(student.getStudentNum());
    }

    private boolean isBcryptHash(String value) {
        return value != null && (value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$"));
    }
}
