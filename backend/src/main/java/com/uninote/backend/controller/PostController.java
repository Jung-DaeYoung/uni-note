package com.uninote.backend.controller;

import com.uninote.backend.dto.PostRequest;
import com.uninote.backend.dto.PostResponse;
import com.uninote.backend.service.PostService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class PostController {

    private final PostService postService;

    @GetMapping("/{courseId}")
    public ResponseEntity<List<PostResponse>> getPosts(
            @PathVariable Long courseId,
            @AuthenticationPrincipal String studentNum) {
        return ResponseEntity.ok(postService.getPosts(courseId, studentNum));
    }

    @PostMapping("/{courseId}")
    public ResponseEntity<PostResponse> savePost(
            @PathVariable Long courseId,
            @AuthenticationPrincipal String studentNum,
            @RequestBody PostRequest request) {
        return ResponseEntity.ok(postService.savePost(courseId, studentNum, request));
    }

    @PostMapping("/{postId}/comments")
    public ResponseEntity<Void> addComment(
            @PathVariable Long postId,
            @AuthenticationPrincipal String studentNum,
            @RequestBody com.uninote.backend.dto.CommentRequest request) {
        postService.addComment(postId, studentNum, request.getContent());
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{postId}")
    public ResponseEntity<Void> deletePost(
            @PathVariable Long postId,
            @AuthenticationPrincipal String studentNum) {
        postService.deletePost(postId, studentNum);
        return ResponseEntity.ok().build();
    }
}
