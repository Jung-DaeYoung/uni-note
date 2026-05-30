package com.uninote.backend.controller;

import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.*;
import com.uninote.backend.repository.StudentRepository;
import com.uninote.backend.service.QuizService;
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
        Student student = studentRepository.findByStudentNum(principal.getName())
                .orElseThrow(() -> new RuntimeException("학생 정보를 찾을 수 없습니다."));
        quizService.deleteQuiz(quizSetId, student);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{quizSetId}")
    public ResponseEntity<QuizSetDetailResponse> getQuizDetail(@PathVariable Long quizSetId) {
        return ResponseEntity.ok(quizService.getQuizDetail(quizSetId));
    }

    @GetMapping("/my")
    public ResponseEntity<List<QuizSetResponse>> getMyQuizzes(Principal principal) {
        Student student = studentRepository.findByStudentNum(principal.getName())
                .orElseThrow(() -> new RuntimeException("학생 정보를 찾을 수 없습니다."));
        return ResponseEntity.ok(quizService.getMyQuizzes(student));
    }

    @PostMapping("/generate")
    public ResponseEntity<QuizResponse> generateQuiz(@RequestBody QuizRequest request, Principal principal) {
        Student student = studentRepository.findByStudentNum(principal.getName())
                .orElseThrow(() -> new RuntimeException("학생 정보를 찾을 수 없습니다."));
        
        QuizResponse response = quizService.generateQuiz(request, student);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/attempts")
    public ResponseEntity<Void> saveAttempt(@RequestBody QuizAttemptRequest request, Principal principal) {
        Student student = studentRepository.findByStudentNum(principal.getName())
                .orElseThrow(() -> new RuntimeException("학생 정보를 찾을 수 없습니다."));
        quizService.saveAttempt(request, student);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/attempts/my")
    public ResponseEntity<List<QuizAttemptResponse>> getMyAttempts(Principal principal) {
        Student student = studentRepository.findByStudentNum(principal.getName())
                .orElseThrow(() -> new RuntimeException("학생 정보를 찾을 수 없습니다."));
        return ResponseEntity.ok(quizService.getMyAttempts(student));
    }

    @GetMapping("/attempts/{attemptId}")
    public ResponseEntity<QuizAttemptDetailResponse> getAttemptDetail(@PathVariable Long attemptId) {
        return ResponseEntity.ok(quizService.getAttemptDetail(attemptId));
    }

    @GetMapping("/{quizSetId}/attempts")
    public ResponseEntity<List<QuizAttemptResponse>> getAttemptsByQuizSet(@PathVariable Long quizSetId, Principal principal) {
        Student student = studentRepository.findByStudentNum(principal.getName())
                .orElseThrow(() -> new RuntimeException("학생 정보를 찾을 수 없습니다."));
        return ResponseEntity.ok(quizService.getAttemptsByQuizSet(quizSetId, student));
    }
}
