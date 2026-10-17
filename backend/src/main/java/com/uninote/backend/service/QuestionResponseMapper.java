package com.uninote.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
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
        qr.setOptions(readList(q.getOptions()));
        qr.setCorrectAnswer(q.getCorrectAnswer());
        qr.setExplanation(q.getExplanation());
        qr.setSourceNoteId(q.getSourceNoteId());
        qr.setSourceBlockId(q.getSourceBlockId());
        qr.setConceptTags(readList(q.getConceptTags()));
        return qr;
    }

    // options·conceptTags는 JSON 문자열 배열로 저장된다. 값이 없거나(태그 도입 전 문제) 읽을 수 없으면 빈 배열로 응답한다.
    private List<String> readList(String json) {
        if (json == null) return new ArrayList<>();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }
}
