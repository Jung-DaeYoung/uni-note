package com.uninote.backend.controller;

import com.uninote.backend.dto.KeywordExplainRequest;
import com.uninote.backend.dto.KeywordExplainResponse;
import com.uninote.backend.repository.StudentRepository;
import com.uninote.backend.service.KeywordService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

@RestController
@RequestMapping("/api/keywords")
@RequiredArgsConstructor
public class KeywordController {
    private final KeywordService keywordService;
    private final StudentRepository studentRepository;

    @PostMapping("/explain")
    public ResponseEntity<KeywordExplainResponse> explain(@Valid @RequestBody KeywordExplainRequest request,
                                                          Principal principal) {
        return ResponseEntity.ok(keywordService.explain(request,
                studentRepository.getByStudentNum(principal.getName())));
    }
}
