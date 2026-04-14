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
        
        // 테스트 환경: DB에 평문으로 저장된 비밀번호와 직접 비교 (앞뒤 공백 제거 추가)
        String rawPassword = loginRequest.getPassword() != null ? loginRequest.getPassword().trim() : "";
        String dbPassword = student.getPassword() != null ? student.getPassword().trim() : "";

        if (!rawPassword.equals(dbPassword)) {
            log.error("로그인 실패: 비밀번호가 일치하지 않습니다. 학번: {}, 입력비밀번호길이: {}, DB비밀번호길이: {}", 
                    loginRequest.getStudentNum(), rawPassword.length(), dbPassword.length());
            throw new IllegalArgumentException("비밀번호가 일치하지 않습니다.");
        }
        
        log.info("로그인 성공 - 학번: {}", loginRequest.getStudentNum());
        return jwtUtil.generateToken(student.getStudentNum());
    }
}
