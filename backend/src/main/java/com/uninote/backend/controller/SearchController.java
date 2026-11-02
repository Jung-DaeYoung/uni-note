package com.uninote.backend.controller;

import com.uninote.backend.dto.SearchResponse;
import com.uninote.backend.repository.StudentRepository;
import com.uninote.backend.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {
    private final SearchService searchService;
    private final StudentRepository studentRepository;

    // 파라미터 누락·길이·유형은 서비스에서 400(INVALID_REQUEST)으로 검증한다.
    @GetMapping
    public ResponseEntity<SearchResponse> search(@RequestParam(required = false) String q,
                                                 @RequestParam(defaultValue = "all") String type,
                                                 @RequestParam(required = false) Long courseId,
                                                 @RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "20") int size,
                                                 Principal principal) {
        return ResponseEntity.ok(searchService.search(
                studentRepository.getByStudentNum(principal.getName()), q, type, courseId, page, size));
    }
}
