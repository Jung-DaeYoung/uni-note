package com.uninote.backend.controller;

import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.*;
import com.uninote.backend.repository.StudentRepository;
import com.uninote.backend.service.QuizService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.security.Principal;

@RestController
@RequestMapping("/api/quiz")
@RequiredArgsConstructor
public class QuizController {
    private final QuizService quizService;
    private final StudentRepository studentRepository;

    @DeleteMapping("/{quizSetId}")
    public ResponseEntity<Void> deleteQuiz(@PathVariable Long quizSetId, Principal principal) {
        Student student = studentRepository.getByStudentNum(principal.getName());
        quizService.deleteQuiz(quizSetId, student);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{quizSetId}")
    public ResponseEntity<QuizSetDetailResponse> getQuizDetail(@PathVariable Long quizSetId, Principal principal) {
        Student student = studentRepository.getByStudentNum(principal.getName());
        return ResponseEntity.ok(quizService.getQuizDetail(quizSetId, student));
    }

    @GetMapping("/my")
    public ResponseEntity<List<QuizSetResponse>> getMyQuizzes(Principal principal) {
        Student student = studentRepository.getByStudentNum(principal.getName());
        return ResponseEntity.ok(quizService.getMyQuizzes(student));
    }

    @PostMapping("/generate")
    public ResponseEntity<QuizResponse> generateQuiz(@Valid @RequestBody QuizRequest request, Principal principal) {
        Student student = studentRepository.getByStudentNum(principal.getName());

        QuizResponse response = quizService.generateQuiz(request, student);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/attempts")
    public ResponseEntity<Void> saveAttempt(@Valid @RequestBody QuizAttemptRequest request, Principal principal) {
        Student student = studentRepository.getByStudentNum(principal.getName());
        quizService.saveAttempt(request, student);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/attempts/my")
    public ResponseEntity<List<QuizAttemptResponse>> getMyAttempts(Principal principal) {
        Student student = studentRepository.getByStudentNum(principal.getName());
        return ResponseEntity.ok(quizService.getMyAttempts(student));
    }

    @GetMapping("/attempts/{attemptId}")
    public ResponseEntity<QuizAttemptDetailResponse> getAttemptDetail(@PathVariable Long attemptId, Principal principal) {
        Student student = studentRepository.getByStudentNum(principal.getName());
        return ResponseEntity.ok(quizService.getAttemptDetail(attemptId, student));
    }

    @GetMapping("/{quizSetId}/attempts")
    public ResponseEntity<List<QuizAttemptResponse>> getAttemptsByQuizSet(@PathVariable Long quizSetId, Principal principal) {
        Student student = studentRepository.getByStudentNum(principal.getName());
        return ResponseEntity.ok(quizService.getAttemptsByQuizSet(quizSetId, student));
    }
}
