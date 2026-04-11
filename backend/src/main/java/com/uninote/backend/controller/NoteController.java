package com.uninote.backend.controller;

import com.uninote.backend.dto.NoteRequest;
import com.uninote.backend.dto.NoteResponse;
import com.uninote.backend.service.NoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notes")
@RequiredArgsConstructor
public class NoteController {

    private final NoteService noteService;

    @GetMapping("/{courseId}")
    public ResponseEntity<NoteResponse> getNote(
            @PathVariable Long courseId,
            @AuthenticationPrincipal String studentNum) {
        return ResponseEntity.ok(noteService.getNote(courseId, studentNum));
    }

    @PostMapping("/{courseId}")
    public ResponseEntity<NoteResponse> saveNote(
            @PathVariable Long courseId,
            @AuthenticationPrincipal String studentNum,
            @RequestBody NoteRequest request) {
        return ResponseEntity.ok(noteService.saveNote(courseId, studentNum, request));
    }
}
