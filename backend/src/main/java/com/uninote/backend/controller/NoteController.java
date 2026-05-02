package com.uninote.backend.controller;

import com.uninote.backend.dto.NoteRequest;
import com.uninote.backend.dto.NoteResponse;
import com.uninote.backend.dto.NoteTreeResponse;
import com.uninote.backend.service.NoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class NoteController {

    private final NoteService noteService;

    // 노트 상세 조회 (본문 + 브레드크럼)
    @GetMapping("/notes/{noteId}")
    public ResponseEntity<NoteResponse> getNote(
            @PathVariable Long noteId,
            @AuthenticationPrincipal String studentNum) {
        return ResponseEntity.ok(noteService.getNote(noteId, studentNum));
    }

    // 강의별 노트 트리 구조 조회 (사이드바용)
    @GetMapping("/courses/{courseId}/notes/tree")
    public ResponseEntity<List<NoteTreeResponse>> getNoteTree(
            @PathVariable Long courseId,
            @AuthenticationPrincipal String studentNum) {
        return ResponseEntity.ok(noteService.getNoteTree(courseId, studentNum));
    }

    // 새 노트 생성 (루트 또는 하위 노트)
    @PostMapping("/courses/{courseId}/notes")
    public ResponseEntity<NoteResponse> createNote(
            @PathVariable Long courseId,
            @RequestParam(required = false) Long parentNoteId,
            @AuthenticationPrincipal String studentNum) {
        return ResponseEntity.ok(noteService.createNote(courseId, parentNoteId, studentNum));
    }

    // 노트 수정 저장
    @PutMapping("/notes/{noteId}")
    public ResponseEntity<NoteResponse> saveNote(
            @PathVariable Long noteId,
            @RequestBody NoteRequest request) {
        return ResponseEntity.ok(noteService.saveNote(noteId, request));
    }

    // 노트 삭제
    @DeleteMapping("/notes/{noteId}")
    public ResponseEntity<Void> deleteNote(
            @PathVariable Long noteId,
            @AuthenticationPrincipal String studentNum) {
        noteService.deleteNote(noteId, studentNum);
        return ResponseEntity.ok().build();
    }
}
