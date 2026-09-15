package com.uninote.backend.service;

import com.uninote.backend.domain.*;
import com.uninote.backend.dto.*;
import com.uninote.backend.exception.CourseAccessException;
import com.uninote.backend.exception.InvalidRequestException;
import com.uninote.backend.exception.ResourceNotFoundException;
import com.uninote.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IncorrectNoteService {
    private final IncorrectNoteGroupRepository groupRepository;
    private final IncorrectNoteItemRepository itemRepository;
    private final QuestionRepository questionRepository;
    private final QuestionResponseMapper questionResponseMapper;

    @Transactional(readOnly = true)
    public List<IncorrectNoteGroupResponse> getMyGroups(Student student) {
        return groupRepository.findByStudent_StudId(student.getStudId()).stream()
            .map(g -> IncorrectNoteGroupResponse.builder()
                .id(g.getId())
                .title(g.getTitle())
                .itemCount(g.getItems().size())
                .createdAt(g.getCreatedAt())
                .build())
            .collect(Collectors.toList());
    }

    @Transactional
    public void addToGroup(AddToIncorrectRequest request, Student student) {
        IncorrectNoteGroup group;
        
        if (request.getGroupId() != null) {
            group = groupRepository.findById(request.getGroupId())
                .orElseThrow(() -> new ResourceNotFoundException("오답노트를 찾을 수 없습니다."));
            validateOwnership(group, student);
        } else if (request.getNewGroupTitle() != null && !request.getNewGroupTitle().trim().isEmpty()) {
            group = groupRepository.findByStudent_StudIdAndTitle(student.getStudId(), request.getNewGroupTitle())
                .orElseGet(() -> {
                    IncorrectNoteGroup newGroup = new IncorrectNoteGroup();
                    newGroup.setStudent(student);
                    newGroup.setTitle(request.getNewGroupTitle());
                    return groupRepository.save(newGroup);
                });
        } else {
            throw new InvalidRequestException("그룹 ID 또는 새 그룹 제목이 필요합니다.");
        }

        Question question = questionRepository.findById(request.getQuestionId())
            .orElseThrow(() -> new ResourceNotFoundException("문제를 찾을 수 없습니다."));

        // 중복 체크
        if (itemRepository.findByGroup_IdAndQuestion_QuestionId(group.getId(), question.getQuestionId()).isEmpty()) {
            IncorrectNoteItem item = new IncorrectNoteItem();
            item.setGroup(group);
            item.setQuestion(question);
            itemRepository.save(item);
        }
    }

    @Transactional
    public void deleteGroup(Long groupId, Student student) {
        IncorrectNoteGroup group = groupRepository.findById(groupId)
            .orElseThrow(() -> new ResourceNotFoundException("오답노트를 찾을 수 없습니다."));

        validateOwnership(group, student);

        groupRepository.delete(group);
    }

    @Transactional
    public void removeItemFromGroup(Long groupId, Long questionId, Student student) {
        IncorrectNoteGroup group = groupRepository.findById(groupId)
            .orElseThrow(() -> new ResourceNotFoundException("오답노트를 찾을 수 없습니다."));

        validateOwnership(group, student);

        itemRepository.findByGroup_IdAndQuestion_QuestionId(groupId, questionId)
            .ifPresent(itemRepository::delete);
    }

    @Transactional(readOnly = true)
    public QuizSetDetailResponse getPracticeSession(Long groupId, Student student) {
        IncorrectNoteGroup group = groupRepository.findById(groupId)
            .orElseThrow(() -> new ResourceNotFoundException("오답노트를 찾을 수 없습니다."));

        validateOwnership(group, student);

        List<QuestionResponse> questions = group.getItems().stream()
            .map(item -> questionResponseMapper.toResponse(item.getQuestion()))
            .collect(Collectors.toList());

        return QuizSetDetailResponse.builder()
            .quizSetId(-1L) // 가상 ID
            .title(group.getTitle() + " (오답 복습)")
            .difficulty(QuizDifficulty.NORMAL)
            .questions(questions)
            .build();
    }

    private void validateOwnership(IncorrectNoteGroup group, Student student) {
        if (!group.getStudent().getStudId().equals(student.getStudId())) {
            throw new CourseAccessException("본인 오답노트 그룹만 접근할 수 있습니다.");
        }
    }
}
