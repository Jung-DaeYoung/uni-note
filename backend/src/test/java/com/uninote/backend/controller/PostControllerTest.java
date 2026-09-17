package com.uninote.backend.controller;

import com.uninote.backend.dto.CommentRequest;
import com.uninote.backend.dto.PostRequest;
import com.uninote.backend.dto.PostResponse;
import com.uninote.backend.service.PostService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PostControllerTest {

    private final PostService postService = mock(PostService.class);
    private final PostController postController = new PostController(postService);

    @Test
    void getPostsDelegatesToServiceWithAuthenticatedStudent() {
        List<PostResponse> expected = List.of(PostResponse.builder().postId(1L).title("제목").build());
        when(postService.getPosts(10L, "2021001")).thenReturn(expected);

        ResponseEntity<List<PostResponse>> response = postController.getPosts(10L, "2021001");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isSameAs(expected);
    }

    @Test
    void savePostDelegatesRequestBodyToService() {
        PostRequest request = new PostRequest("제목", "내용");
        PostResponse expected = PostResponse.builder().postId(1L).title("제목").build();
        when(postService.savePost(10L, "2021001", request)).thenReturn(expected);

        ResponseEntity<PostResponse> response = postController.savePost(10L, "2021001", request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isSameAs(expected);
    }

    @Test
    void addCommentDelegatesContentToService() {
        CommentRequest request = new CommentRequest("댓글 내용");

        ResponseEntity<Void> response = postController.addComment(1L, "2021001", request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(postService).addComment(1L, "2021001", "댓글 내용");
    }

    @Test
    void updateCommentDelegatesContentToService() {
        CommentRequest request = new CommentRequest("수정된 댓글");

        ResponseEntity<Void> response = postController.updateComment(1L, "2021001", request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(postService).updateComment(1L, "2021001", "수정된 댓글");
    }

    @Test
    void deleteCommentDelegatesToService() {
        ResponseEntity<Void> response = postController.deleteComment(1L, "2021001");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(postService).deleteComment(1L, "2021001");
    }

    @Test
    void deletePostDelegatesToService() {
        ResponseEntity<Void> response = postController.deletePost(1L, "2021001");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(postService).deletePost(1L, "2021001");
    }

    @Test
    void updatePostDelegatesRequestBodyToService() {
        PostRequest request = new PostRequest("수정 제목", "수정 내용");
        PostResponse expected = PostResponse.builder().postId(1L).title("수정 제목").build();
        when(postService.updatePost(1L, "2021001", request)).thenReturn(expected);

        ResponseEntity<PostResponse> response = postController.updatePost(1L, "2021001", request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isSameAs(expected);
    }
}
