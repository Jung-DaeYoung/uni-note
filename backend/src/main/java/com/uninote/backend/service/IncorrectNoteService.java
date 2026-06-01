package com.uninote.backend.service;

import com.uninote.backend.domain.*;
import com.uninote.backend.dto.*;
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
    private final QuizService quizService;

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
                .orElseThrow(() -> new IllegalArgumentException("오답노트를 찾을 수 없습니다."));
        } else if (request.getNewGroupTitle() != null && !request.getNewGroupTitle().trim().isEmpty()) {
            group = groupRepository.findByStudent_StudIdAndTitle(student.getStudId(), request.getNewGroupTitle())
                .orElseGet(() -> {
                    IncorrectNoteGroup newGroup = new IncorrectNoteGroup();
                    newGroup.setStudent(student);
                    newGroup.setTitle(request.getNewGroupTitle());
                    return groupRepository.save(newGroup);
                });
        } else {
            throw new IllegalArgumentException("그룹 ID 또는 새 그룹 제목이 필요합니다.");
        }

        Question question = questionRepository.findById(request.getQuestionId())
            .orElseThrow(() -> new IllegalArgumentException("문제를 찾을 수 없습니다."));

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
            .orElseThrow(() -> new IllegalArgumentException("오답노트를 찾을 수 없습니다."));
        
        if (!group.getStudent().getStudId().equals(student.getStudId())) {
            throw new RuntimeException("삭제 권한이 없습니다.");
        }
        
        groupRepository.delete(group);
    }

    @Transactional
    public void removeItemFromGroup(Long groupId, Long questionId, Student student) {
        IncorrectNoteGroup group = groupRepository.findById(groupId)
            .orElseThrow(() -> new IllegalArgumentException("오답노트를 찾을 수 없습니다."));
        
        if (!group.getStudent().getStudId().equals(student.getStudId())) {
            throw new RuntimeException("권한이 없습니다.");
        }

        itemRepository.findByGroup_IdAndQuestion_QuestionId(groupId, questionId)
            .ifPresent(itemRepository::delete);
    }

    @Transactional(readOnly = true)
    public QuizSetDetailResponse getPracticeSession(Long groupId, Student student) {
        IncorrectNoteGroup group = groupRepository.findById(groupId)
            .orElseThrow(() -> new IllegalArgumentException("오답노트를 찾을 수 없습니다."));
        
        if (!group.getStudent().getStudId().equals(student.getStudId())) {
            throw new RuntimeException("권한이 없습니다.");
        }

        List<QuestionResponse> questions = group.getItems().stream()
            .map(item -> {
                Question q = item.getQuestion();
                QuestionResponse qr = new QuestionResponse();
                qr.setQuestionId(q.getQuestionId());
                qr.setType(q.getType());
                qr.setQuestionText(q.getQuestionText());
                // options, explanation 등 QuizService의 로직 재활용 필요 (또는 별도 유틸리티화)
                // 여기서는 간단히 QuizService의 형식을 따름 (실제 구현 시 DTO 변환 로직 중복 제거 권장)
                return quizService.getQuestionResponse(q); 
            })
            .collect(Collectors.toList());

        return QuizSetDetailResponse.builder()
            .quizSetId(-1L) // 가상 ID
            .title(group.getTitle() + " (오답 복습)")
            .difficulty(QuizDifficulty.NORMAL)
            .questions(questions)
            .build();
    }
}
