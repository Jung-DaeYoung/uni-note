package com.uninote.backend.controller;

import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.*;
import com.uninote.backend.repository.StudentRepository;
import com.uninote.backend.service.IncorrectNoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/quiz/incorrect")
@RequiredArgsConstructor
public class IncorrectNoteController {
    private final IncorrectNoteService incorrectNoteService;
    private final StudentRepository studentRepository;

    @GetMapping("/groups")
    public ResponseEntity<List<IncorrectNoteGroupResponse>> getMyGroups(Principal principal) {
        Student student = getStudent(principal);
        return ResponseEntity.ok(incorrectNoteService.getMyGroups(student));
    }

    @PostMapping("/add-to-group")
    public ResponseEntity<Void> addToGroup(@RequestBody AddToIncorrectRequest request, Principal principal) {
        Student student = getStudent(principal);
        incorrectNoteService.addToGroup(request, student);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/groups/{groupId}")
    public ResponseEntity<Void> deleteGroup(@PathVariable Long groupId, Principal principal) {
        Student student = getStudent(principal);
        incorrectNoteService.deleteGroup(groupId, student);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/groups/{groupId}/questions/{questionId}")
    public ResponseEntity<Void> removeItem(@PathVariable Long groupId, @PathVariable Long questionId, Principal principal) {
        Student student = getStudent(principal);
        incorrectNoteService.removeItemFromGroup(groupId, questionId, student);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/groups/{groupId}/practice")
    public ResponseEntity<QuizSetDetailResponse> getPracticeSession(@PathVariable Long groupId, Principal principal) {
        Student student = getStudent(principal);
        return ResponseEntity.ok(incorrectNoteService.getPracticeSession(groupId, student));
    }

    private Student getStudent(Principal principal) {
        return studentRepository.findByStudentNum(principal.getName())
                .orElseThrow(() -> new RuntimeException("학생 정보를 찾을 수 없습니다."));
    }
}
