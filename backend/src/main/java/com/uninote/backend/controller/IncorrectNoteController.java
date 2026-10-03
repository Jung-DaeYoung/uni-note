package com.uninote.backend.controller;

import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.*;
import com.uninote.backend.repository.StudentRepository;
import com.uninote.backend.service.IncorrectNoteService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/quiz/incorrect")
@RequiredArgsConstructor
@Validated
public class IncorrectNoteController {
    private final IncorrectNoteService incorrectNoteService;
    private final StudentRepository studentRepository;

    @GetMapping("/groups")
    public ResponseEntity<List<IncorrectNoteGroupResponse>> getMyGroups(Principal principal) {
        return ResponseEntity.ok(incorrectNoteService.getMyGroups(getStudent(principal)));
    }

    @PostMapping("/add-to-group")
    public ResponseEntity<Void> addToGroup(@Valid @RequestBody AddToIncorrectRequest request, Principal principal) {
        incorrectNoteService.addToGroup(request, getStudent(principal));
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/groups/{groupId}")
    public ResponseEntity<Void> deleteGroup(@PathVariable @Positive Long groupId, Principal principal) {
        incorrectNoteService.deleteGroup(groupId, getStudent(principal));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/groups/{groupId}/practice")
    public ResponseEntity<QuizSetDetailResponse> getPracticeSession(@PathVariable @Positive Long groupId, Principal principal) {
        return ResponseEntity.ok(incorrectNoteService.getPracticeSession(groupId, getStudent(principal)));
    }

    @GetMapping("/summary")
    public ResponseEntity<IncorrectSummaryResponse> getSummary(Principal principal) {
        return ResponseEntity.ok(incorrectNoteService.getSummary(getStudent(principal)));
    }

    @GetMapping("/statistics/courses")
    public ResponseEntity<List<CourseIncorrectStatResponse>> getCourseStatistics(Principal principal) {
        return ResponseEntity.ok(incorrectNoteService.getCourseStatistics(getStudent(principal)));
    }

    @GetMapping("/statistics/types")
    public ResponseEntity<List<QuestionTypeIncorrectStatResponse>> getTypeStatistics(Principal principal) {
        return ResponseEntity.ok(incorrectNoteService.getTypeStatistics(getStudent(principal)));
    }

    @GetMapping("/statistics/blocks")
    public ResponseEntity<List<SourceBlockStatResponse>> getBlockStatistics(Principal principal) {
        return ResponseEntity.ok(incorrectNoteService.getBlockStatistics(getStudent(principal)));
    }

    @GetMapping("/review-today")
    public ResponseEntity<List<TodayReviewQuestionResponse>> getTodayReview(
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) Long courseId,
            Principal principal) {
        return ResponseEntity.ok(incorrectNoteService.getTodayReview(getStudent(principal), limit, courseId));
    }

    private Student getStudent(Principal principal) {
        return studentRepository.getByStudentNum(principal.getName());
    }
}
