package com.uninote.backend.controller;

import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.*;
import com.uninote.backend.repository.StudentRepository;
import com.uninote.backend.service.QuizService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.security.Principal;

@RestController
@RequestMapping("/api/quiz")
@RequiredArgsConstructor
@Validated
public class QuizController {
    private final QuizService quizService;
    private final StudentRepository studentRepository;

    @DeleteMapping("/{quizSetId}")
    public ResponseEntity<Void> deleteQuiz(@PathVariable @Positive Long quizSetId, Principal principal) {
        quizService.deleteQuiz(quizSetId, getStudent(principal));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{quizSetId}")
    public ResponseEntity<QuizSetDetailResponse> getQuizDetail(@PathVariable @Positive Long quizSetId, Principal principal) {
        return ResponseEntity.ok(quizService.getQuizDetail(quizSetId, getStudent(principal)));
    }

    @GetMapping("/my")
    public ResponseEntity<List<QuizSetResponse>> getMyQuizzes(Principal principal) {
        return ResponseEntity.ok(quizService.getMyQuizzes(getStudent(principal)));
    }

    @PostMapping("/generate")
    public ResponseEntity<QuizResponse> generateQuiz(@Valid @RequestBody QuizRequest request, Principal principal) {
        return ResponseEntity.ok(quizService.generateQuiz(request, getStudent(principal)));
    }

    @PostMapping("/attempts")
    public ResponseEntity<Void> saveAttempt(@Valid @RequestBody QuizAttemptRequest request, Principal principal) {
        quizService.saveAttempt(request, getStudent(principal));
        return ResponseEntity.ok().build();
    }

    @GetMapping("/attempts/my")
    public ResponseEntity<List<QuizAttemptResponse>> getMyAttempts(Principal principal) {
        return ResponseEntity.ok(quizService.getMyAttempts(getStudent(principal)));
    }

    @DeleteMapping("/attempts/{attemptId}")
    public ResponseEntity<Void> deleteAttempt(@PathVariable @Positive Long attemptId, Principal principal) {
        quizService.deleteAttempt(attemptId, getStudent(principal));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/attempts/{attemptId}")
    public ResponseEntity<QuizAttemptDetailResponse> getAttemptDetail(@PathVariable @Positive Long attemptId, Principal principal) {
        return ResponseEntity.ok(quizService.getAttemptDetail(attemptId, getStudent(principal)));
    }

    @GetMapping("/{quizSetId}/attempts")
    public ResponseEntity<List<QuizAttemptResponse>> getAttemptsByQuizSet(@PathVariable @Positive Long quizSetId, Principal principal) {
        return ResponseEntity.ok(quizService.getAttemptsByQuizSet(quizSetId, getStudent(principal)));
    }

    private Student getStudent(Principal principal) {
        return studentRepository.getByStudentNum(principal.getName());
    }
}
