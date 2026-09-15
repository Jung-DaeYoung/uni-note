package com.uninote.backend.service;

import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.LoginRequest;
import com.uninote.backend.repository.StudentRepository;
import com.uninote.backend.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AuthServiceTest {

    private final StudentRepository studentRepository = mock(StudentRepository.class);
    private final JwtUtil jwtUtil = mock(JwtUtil.class);
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    private final AuthService authService = new AuthService(studentRepository, jwtUtil, passwordEncoder);

    private Student student;

    @BeforeEach
    void setUp() {
        student = new Student();
        student.setStudId(1L);
        student.setStudentNum("20240001");
    }

    @Test
    void logsInWithAlreadyHashedPasswordWithoutRehashing() {
        student.setPassword(passwordEncoder.encode("correct-password"));
        when(studentRepository.findByStudentNum("20240001")).thenReturn(Optional.of(student));
        when(jwtUtil.generateToken("20240001")).thenReturn("token-value");

        LoginRequest request = new LoginRequest();
        request.setStudentNum("20240001");
        request.setPassword("correct-password");

        String token = authService.login(request);

        assertThat(token).isEqualTo("token-value");
        verify(studentRepository, never()).save(any());
    }

    @Test
    void rejectsWrongPasswordAgainstHashedPassword() {
        student.setPassword(passwordEncoder.encode("correct-password"));
        when(studentRepository.findByStudentNum("20240001")).thenReturn(Optional.of(student));

        LoginRequest request = new LoginRequest();
        request.setStudentNum("20240001");
        request.setPassword("wrong-password");

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(IllegalArgumentException.class);

        verify(studentRepository, never()).save(any());
        verifyNoInteractions(jwtUtil);
    }

    @Test
    void logsInWithLegacyPlaintextPasswordAndMigratesItToAHash() {
        student.setPassword("legacy-plaintext-password"); // 아직 해시로 전환되지 않은 계정
        when(studentRepository.findByStudentNum("20240001")).thenReturn(Optional.of(student));
        when(jwtUtil.generateToken("20240001")).thenReturn("token-value");

        LoginRequest request = new LoginRequest();
        request.setStudentNum("20240001");
        request.setPassword("legacy-plaintext-password");

        String token = authService.login(request);

        assertThat(token).isEqualTo("token-value");
        verify(studentRepository).save(student);
        // 로그인 성공 직후 저장된 비밀번호는 더 이상 평문이 아니라 BCrypt 해시여야 한다.
        assertThat(student.getPassword()).startsWith("$2");
        assertThat(passwordEncoder.matches("legacy-plaintext-password", student.getPassword())).isTrue();
    }

    @Test
    void rejectsWrongPasswordAgainstLegacyPlaintextPasswordWithoutMigrating() {
        student.setPassword("legacy-plaintext-password");
        when(studentRepository.findByStudentNum("20240001")).thenReturn(Optional.of(student));

        LoginRequest request = new LoginRequest();
        request.setStudentNum("20240001");
        request.setPassword("wrong-password");

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(IllegalArgumentException.class);

        verify(studentRepository, never()).save(any());
        assertThat(student.getPassword()).isEqualTo("legacy-plaintext-password"); // 마이그레이션 안 됨
    }

    @Test
    void rejectsLoginForUnknownStudentNum() {
        when(studentRepository.findByStudentNum("unknown")).thenReturn(Optional.empty());

        LoginRequest request = new LoginRequest();
        request.setStudentNum("unknown");
        request.setPassword("anything");

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(IllegalArgumentException.class);

        verifyNoInteractions(jwtUtil);
    }
}
