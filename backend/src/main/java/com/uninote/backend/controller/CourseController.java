package com.uninote.backend.controller;

import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.CourseRequest;
import com.uninote.backend.dto.CourseResponse;
import com.uninote.backend.repository.StudentRepository;
import com.uninote.backend.service.CourseService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

// 직접 생성 강의 관리. 목록은 기존 /api/dashboard/courses가 함께 내려준다.
@RestController
@RequestMapping("/api/courses")
@RequiredArgsConstructor
@Validated
public class CourseController {
    private final CourseService courseService;
    private final StudentRepository studentRepository;

    @PostMapping
    public ResponseEntity<CourseResponse> create(@Valid @RequestBody CourseRequest request, Principal principal) {
        return ResponseEntity.ok(courseService.create(request.getCourseName(), getStudent(principal)));
    }

    @PutMapping("/{courseId}")
    public ResponseEntity<CourseResponse> rename(
            @PathVariable @Positive Long courseId,
            @Valid @RequestBody CourseRequest request,
            Principal principal) {
        return ResponseEntity.ok(courseService.rename(courseId, request.getCourseName(), getStudent(principal)));
    }

    @DeleteMapping("/{courseId}")
    public ResponseEntity<Void> delete(@PathVariable @Positive Long courseId, Principal principal) {
        courseService.delete(courseId, getStudent(principal));
        return ResponseEntity.noContent().build();
    }

    private Student getStudent(Principal principal) {
        return studentRepository.getByStudentNum(principal.getName());
    }
}
