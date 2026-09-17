package com.uninote.backend.controller;

import com.uninote.backend.domain.Student;
import com.uninote.backend.exception.ResourceNotFoundException;
import com.uninote.backend.repository.StudentRepository;
import com.uninote.backend.service.IncorrectNoteService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.security.Principal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class IncorrectNoteControllerTest {

    private final IncorrectNoteService incorrectNoteService = mock(IncorrectNoteService.class);
    private final StudentRepository studentRepository = mock(StudentRepository.class);

    private final IncorrectNoteController incorrectNoteController =
            new IncorrectNoteController(incorrectNoteService, studentRepository);

    private Principal principal;

    @BeforeEach
    void setUp() {
        // StudentRepository.getByStudentNum(...)은 default 메서드라 mock()이 실제 본문을 실행하지 않는다.
        // 각 테스트가 개별적으로 stub하는 findByStudentNum(...)에 위임하도록 한 번만 연결해준다.
        lenient().when(studentRepository.getByStudentNum(anyString()))
                .thenAnswer(invocation -> studentRepository.findByStudentNum(invocation.getArgument(0))
                        .orElseThrow(() -> new ResourceNotFoundException("학생 정보를 찾을 수 없습니다.")));

        principal = mock(Principal.class);
        when(principal.getName()).thenReturn("unknown-num");
        when(studentRepository.findByStudentNum("unknown-num")).thenReturn(Optional.empty());
    }

    @Test
    void getMyGroupsReportsMissingStudentAsNotFound() {
        assertThatThrownBy(() -> incorrectNoteController.getMyGroups(principal))
                .isInstanceOf(ResourceNotFoundException.class);

        verifyNoInteractions(incorrectNoteService);
    }

    @Test
    void getMyGroupsSucceedsForKnownStudent() {
        Student student = new Student();
        student.setStudId(1L);
        student.setStudentNum("known-num");
        Principal knownPrincipal = mock(Principal.class);
        when(knownPrincipal.getName()).thenReturn("known-num");
        when(studentRepository.findByStudentNum("known-num")).thenReturn(Optional.of(student));

        incorrectNoteController.getMyGroups(knownPrincipal);
    }
}
