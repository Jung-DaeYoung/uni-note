package com.uninote.backend.controller;

import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.CommentRequest;
import com.uninote.backend.dto.CommentResponse;
import com.uninote.backend.dto.ShareNoteRequest;
import com.uninote.backend.dto.SharedNoteDetailResponse;
import com.uninote.backend.dto.SharedNoteResponse;
import com.uninote.backend.repository.StudentRepository;
import com.uninote.backend.service.SharedNoteService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/shared-notes")
@RequiredArgsConstructor
@Validated
public class SharedNoteController {
    private final SharedNoteService sharedNoteService;
    private final StudentRepository studentRepository;

    @GetMapping
    public ResponseEntity<List<SharedNoteResponse>> getSharedNotes(
            @RequestParam(required = false) @Positive Long courseId,
            Principal principal) {
        return ResponseEntity.ok(sharedNoteService.getSharedNotes(getStudent(principal), courseId));
    }

    @PostMapping
    public ResponseEntity<Void> share(@Valid @RequestBody ShareNoteRequest request, Principal principal) {
        sharedNoteService.share(request.getRootNoteId(), getStudent(principal));
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{postId}")
    public ResponseEntity<SharedNoteDetailResponse> getDetail(@PathVariable @Positive Long postId, Principal principal) {
        return ResponseEntity.ok(sharedNoteService.getDetail(postId, getStudent(principal)));
    }

    @DeleteMapping("/{postId}")
    public ResponseEntity<Void> deletePost(@PathVariable @Positive Long postId, Principal principal) {
        sharedNoteService.deletePost(postId, getStudent(principal));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{postId}/comments")
    public ResponseEntity<List<CommentResponse>> getComments(@PathVariable @Positive Long postId, Principal principal) {
        return ResponseEntity.ok(sharedNoteService.getComments(postId, getStudent(principal)));
    }

    @PostMapping("/{postId}/comments")
    public ResponseEntity<CommentResponse> addComment(
            @PathVariable @Positive Long postId,
            @Valid @RequestBody CommentRequest request,
            Principal principal) {
        return ResponseEntity.ok(sharedNoteService.addComment(postId, request.getContent(), getStudent(principal)));
    }

    @PutMapping("/comments/{commentId}")
    public ResponseEntity<CommentResponse> updateComment(
            @PathVariable @Positive Long commentId,
            @Valid @RequestBody CommentRequest request,
            Principal principal) {
        return ResponseEntity.ok(sharedNoteService.updateComment(commentId, request.getContent(), getStudent(principal)));
    }

    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable @Positive Long commentId, Principal principal) {
        sharedNoteService.deleteComment(commentId, getStudent(principal));
        return ResponseEntity.noContent().build();
    }

    private Student getStudent(Principal principal) {
        return studentRepository.getByStudentNum(principal.getName());
    }
}
