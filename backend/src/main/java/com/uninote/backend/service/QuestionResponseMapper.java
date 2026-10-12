package com.uninote.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uninote.backend.domain.Question;
import com.uninote.backend.dto.QuestionResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
public class QuestionResponseMapper {
    private final ObjectMapper objectMapper;

    public QuestionResponse toResponse(Question q) {
        QuestionResponse qr = new QuestionResponse();
        qr.setQuestionId(q.getQuestionId());
        qr.setType(q.getType());
        qr.setQuestionText(q.getQuestionText());
        try {
            qr.setOptions(objectMapper.readValue(q.getOptions(), List.class));
        } catch (Exception e) {
            qr.setOptions(new ArrayList<>());
        }
        qr.setCorrectAnswer(q.getCorrectAnswer());
        qr.setExplanation(q.getExplanation());
        qr.setSourceNoteId(q.getSourceNoteId());
        qr.setSourceBlockId(q.getSourceBlockId());
        return qr;
    }
}
