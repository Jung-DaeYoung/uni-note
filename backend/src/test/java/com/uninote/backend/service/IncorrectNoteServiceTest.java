package com.uninote.backend.service;

import com.uninote.backend.domain.IncorrectNoteGroup;
import com.uninote.backend.domain.Question;
import com.uninote.backend.domain.Student;
import com.uninote.backend.dto.AddToIncorrectRequest;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.exception.InvalidRequestException;
import com.uninote.backend.exception.ResourceNotFoundException;
import com.uninote.backend.repository.IncorrectNoteGroupRepository;
import com.uninote.backend.repository.IncorrectNoteItemRepository;
import com.uninote.backend.repository.QuestionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class IncorrectNoteServiceTest {

    private final IncorrectNoteGroupRepository groupRepository = mock(IncorrectNoteGroupRepository.class);
    private final IncorrectNoteItemRepository itemRepository = mock(IncorrectNoteItemRepository.class);
    private final QuestionRepository questionRepository = mock(QuestionRepository.class);
    private final QuestionResponseMapper questionResponseMapper = mock(QuestionResponseMapper.class);

    private final IncorrectNoteService incorrectNoteService = new IncorrectNoteService(
            groupRepository, itemRepository, questionRepository, questionResponseMapper);

    private Student owner;
    private Student other;
    private IncorrectNoteGroup group;
    private Question question;

    @BeforeEach
    void setUp() {
        owner = new Student();
        owner.setStudId(1L);
        owner.setStudentNum("owner-num");

        other = new Student();
        other.setStudId(2L);
        other.setStudentNum("other-num");

        group = new IncorrectNoteGroup();
        group.setId(30L);
        group.setStudent(owner);
        group.setTitle("오답노트");
        group.setItems(Collections.emptyList());

        question = new Question();
        question.setQuestionId(40L);
    }

    @Test
    void ownerCanAddQuestionToOwnGroup() {
        when(groupRepository.findById(30L)).thenReturn(Optional.of(group));
        when(questionRepository.findById(40L)).thenReturn(Optional.of(question));
        when(itemRepository.findByGroup_IdAndQuestion_QuestionId(30L, 40L)).thenReturn(Optional.empty());

        AddToIncorrectRequest request = new AddToIncorrectRequest();
        request.setGroupId(30L);
        request.setQuestionId(40L);

        incorrectNoteService.addToGroup(request, owner);

        verify(itemRepository).save(any());
    }

    @Test
    void addToGroupThrowsResourceNotFoundWhenGroupDoesNotExist() {
        when(groupRepository.findById(999L)).thenReturn(Optional.empty());

        AddToIncorrectRequest request = new AddToIncorrectRequest();
        request.setGroupId(999L);
        request.setQuestionId(40L);

        assertThatThrownBy(() -> incorrectNoteService.addToGroup(request, owner))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void addToGroupThrowsInvalidRequestWhenNeitherGroupIdNorNewTitleProvided() {
        AddToIncorrectRequest request = new AddToIncorrectRequest();
        request.setQuestionId(40L);

        assertThatThrownBy(() -> incorrectNoteService.addToGroup(request, owner))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void otherStudentCannotAddQuestionToSomeoneElsesGroup() {
        when(groupRepository.findById(30L)).thenReturn(Optional.of(group));

        AddToIncorrectRequest request = new AddToIncorrectRequest();
        request.setGroupId(30L);
        request.setQuestionId(40L);

        assertThatThrownBy(() -> incorrectNoteService.addToGroup(request, other))
                .isInstanceOf(CourseAccessException.class);

        verify(itemRepository, never()).save(any());
    }

    @Test
    void ownerCanDeleteOwnGroup() {
        when(groupRepository.findById(30L)).thenReturn(Optional.of(group));

        incorrectNoteService.deleteGroup(30L, owner);

        verify(groupRepository).delete(group);
    }

    @Test
    void otherStudentCannotDeleteSomeoneElsesGroup() {
        when(groupRepository.findById(30L)).thenReturn(Optional.of(group));

        assertThatThrownBy(() -> incorrectNoteService.deleteGroup(30L, other))
                .isInstanceOf(CourseAccessException.class);

        verify(groupRepository, never()).delete(any(IncorrectNoteGroup.class));
    }

    @Test
    void otherStudentCannotRemoveItemFromSomeoneElsesGroup() {
        when(groupRepository.findById(30L)).thenReturn(Optional.of(group));

        assertThatThrownBy(() -> incorrectNoteService.removeItemFromGroup(30L, 40L, other))
                .isInstanceOf(CourseAccessException.class);

        verify(itemRepository, never()).delete(any());
    }

    @Test
    void ownerCanGetOwnPracticeSession() {
        when(groupRepository.findById(30L)).thenReturn(Optional.of(group));

        var response = incorrectNoteService.getPracticeSession(30L, owner);

        assertThat(response.getTitle()).contains("오답노트");
    }

    @Test
    void otherStudentCannotGetSomeoneElsesPracticeSession() {
        when(groupRepository.findById(30L)).thenReturn(Optional.of(group));

        assertThatThrownBy(() -> incorrectNoteService.getPracticeSession(30L, other))
                .isInstanceOf(CourseAccessException.class);
    }
}
