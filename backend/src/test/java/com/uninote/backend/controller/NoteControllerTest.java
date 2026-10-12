package com.uninote.backend.controller;

import com.uninote.backend.dto.NoteRequest;
import com.uninote.backend.dto.NoteResponse;
import com.uninote.backend.dto.NoteTreeResponse;
import com.uninote.backend.service.NoteService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NoteControllerTest {

    private final NoteService noteService = mock(NoteService.class);
    private final NoteController noteController = new NoteController(noteService);

    @Test
    void getNoteDelegatesToServiceWithAuthenticatedStudent() {
        NoteResponse expected = NoteResponse.builder().noteId(1L).title("제목").build();
        when(noteService.getNote(1L, "2021001")).thenReturn(expected);

        ResponseEntity<NoteResponse> response = noteController.getNote(1L, "2021001");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isSameAs(expected);
    }

    @Test
    void getNoteTreeDelegatesToServiceWithAuthenticatedStudent() {
        List<NoteTreeResponse> expected = List.of(NoteTreeResponse.builder().noteId(1L).title("루트").build());
        when(noteService.getNoteTree(10L, "2021001")).thenReturn(expected);

        ResponseEntity<List<NoteTreeResponse>> response = noteController.getNoteTree(10L, "2021001");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isSameAs(expected);
    }

    @Test
    void createNoteDelegatesToServiceWithCourseParentAndStudent() {
        NoteResponse expected = NoteResponse.builder().noteId(2L).title("제목 없음").build();
        when(noteService.createNote(10L, 1L, "2021001")).thenReturn(expected);

        ResponseEntity<NoteResponse> response = noteController.createNote(10L, 1L, "2021001");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isSameAs(expected);
    }

    @Test
    void saveNoteDelegatesRequestBodyToService() {
        NoteRequest request = new NoteRequest("제목", "내용", "미리보기", "검색용");
        NoteResponse expected = NoteResponse.builder().noteId(1L).title("제목").build();
        when(noteService.saveNote(1L, "2021001", request)).thenReturn(expected);

        ResponseEntity<NoteResponse> response = noteController.saveNote(1L, "2021001", request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isSameAs(expected);
    }

    @Test
    void deleteNoteDelegatesToServiceWithAuthenticatedStudent() {
        ResponseEntity<Void> response = noteController.deleteNote(1L, "2021001");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(noteService).deleteNote(1L, "2021001");
    }
}
