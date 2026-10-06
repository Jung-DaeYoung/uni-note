package com.uninote.backend.controller;

import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.QuizSetDetailResponse;
import com.uninote.backend.dto.ShareQuizRequest;
import com.uninote.backend.dto.SharedQuizLikeResponse;
import com.uninote.backend.dto.SharedQuizResponse;
import com.uninote.backend.repository.StudentRepository;
import com.uninote.backend.service.SharedQuizService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/shared-quizzes")
@RequiredArgsConstructor
@Validated
public class SharedQuizController {
    private final SharedQuizService sharedQuizService;
    private final StudentRepository studentRepository;

    @GetMapping
    public ResponseEntity<List<SharedQuizResponse>> getSharedQuizzes(
            @RequestParam(defaultValue = "latest") String sort,
            @RequestParam(required = false) @Positive Long courseId,
            Principal principal) {
        return ResponseEntity.ok(sharedQuizService.getSharedQuizzes(getStudent(principal), sort, courseId));
    }

    @PostMapping
    public ResponseEntity<Void> share(@Valid @RequestBody ShareQuizRequest request, Principal principal) {
        sharedQuizService.share(request.getQuizSetId(), getStudent(principal));
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{sharedQuizId}")
    public ResponseEntity<QuizSetDetailResponse> getDetail(@PathVariable @Positive Long sharedQuizId, Principal principal) {
        return ResponseEntity.ok(sharedQuizService.getDetail(sharedQuizId, getStudent(principal)));
    }

    @DeleteMapping("/{sharedQuizId}")
    public ResponseEntity<Void> deletePost(@PathVariable @Positive Long sharedQuizId, Principal principal) {
        sharedQuizService.deletePost(sharedQuizId, getStudent(principal));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{sharedQuizId}/like")
    public ResponseEntity<SharedQuizLikeResponse> toggleLike(@PathVariable @Positive Long sharedQuizId, Principal principal) {
        return ResponseEntity.ok(sharedQuizService.toggleLike(sharedQuizId, getStudent(principal)));
    }

    private Student getStudent(Principal principal) {
        return studentRepository.getByStudentNum(principal.getName());
    }
}
