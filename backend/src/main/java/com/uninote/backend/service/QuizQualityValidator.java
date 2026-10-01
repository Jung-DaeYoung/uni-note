package com.uninote.backend.service;

import com.uninote.backend.domain.QuestionType;
import com.uninote.backend.dto.QuestionResponse;
import com.uninote.backend.dto.QuizRequest;
import com.uninote.backend.dto.QuizResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

// AI가 반환한 퀴즈를 저장 전에 검증하고, 통과하면 저장 가능한 형태로 정규화한다.
// 비교 정규화는 채점 규칙(QuizService.isAnswerCorrect, CBTPlayer.jsx)과 같은 trim + 소문자 비교다.
@Component
public class QuizQualityValidator {
    // 미검증(출처 null) 문항이 이 비율을 넘으면 생성 결과 전체를 실패로 본다.
    static final double MAX_UNVERIFIED_RATIO = 0.5;
    // Question.correctAnswer, QuizSet.title은 길이 지정 없는 VARCHAR(255) 컬럼이다.
    static final int MAX_COLUMN_LENGTH = 255;
    static final int MIN_MULTIPLE_CHOICE_OPTIONS = 2;
    static final String DEFAULT_TITLE = "AI 생성 퀴즈";

    public record Result(List<String> errors, int unverifiedCount) {
        public boolean valid() {
            return errors.isEmpty();
        }
    }

    // 치명 오류가 없으면 response를 제자리에서 정규화한다(정답 치환, OX 대문자, 출처 정리, 제목·난이도).
    // 치명 오류가 있으면 response를 건드리지 않고 사유만 반환한다.
    public Result validate(QuizResponse response, QuizRequest request, Map<Long, Set<String>> allowedSources) {
        List<String> errors = new ArrayList<>();
        List<QuestionResponse> questions = response.getQuestions();

        if (questions == null || questions.isEmpty()) {
            errors.add("문항이 없습니다.");
            return new Result(errors, 0);
        }

        validateCounts(questions, request.getTypeCounts(), errors);

        Set<String> seenQuestionTexts = new HashSet<>();
        List<String> resolvedAnswers = new ArrayList<>();
        int unverifiedCount = 0;
        for (int i = 0; i < questions.size(); i++) {
            QuestionResponse q = questions.get(i);
            String label = "문항 " + (i + 1) + ": ";
            resolvedAnswers.add(resolveAnswer(q, label, errors));

            if (StringUtils.hasText(q.getQuestionText()) && !seenQuestionTexts.add(normalize(q.getQuestionText()))) {
                errors.add(label + "같은 세트 안에 중복된 문항입니다.");
            }
            if (!isVerifiedSource(q, allowedSources)) {
                unverifiedCount++;
            }
        }

        if (unverifiedCount > questions.size() * MAX_UNVERIFIED_RATIO) {
            errors.add("출처를 확인할 수 없는 문항이 너무 많습니다: " + unverifiedCount + "/" + questions.size());
        }
        if (!errors.isEmpty()) {
            return new Result(errors, unverifiedCount);
        }

        for (int i = 0; i < questions.size(); i++) {
            QuestionResponse q = questions.get(i);
            q.setCorrectAnswer(resolvedAnswers.get(i));
            if (!isVerifiedSource(q, allowedSources)) {
                q.setSourceNoteId(null);
                q.setSourceBlockId(null);
            }
        }
        response.setTitle(normalizeTitle(response.getTitle()));
        response.setDifficulty(request.getDifficulty());
        return new Result(errors, unverifiedCount);
    }

    private void validateCounts(List<QuestionResponse> questions, Map<QuestionType, Integer> typeCounts,
                                List<String> errors) {
        Map<QuestionType, Integer> actual = new EnumMap<>(QuestionType.class);
        for (QuestionResponse q : questions) {
            if (q.getType() != null) {
                actual.merge(q.getType(), 1, Integer::sum);
            }
        }
        for (QuestionType type : QuestionType.values()) {
            int expected = typeCounts.getOrDefault(type, 0);
            int got = actual.getOrDefault(type, 0);
            if (expected != got) {
                errors.add(type + " 문항 수 불일치: 요청 " + expected + ", 응답 " + got);
            }
        }
    }

    // 문항 필수값과 유형별 정답 형식을 검사하고, 저장할 정답 값을 돌려준다(오류면 null).
    private String resolveAnswer(QuestionResponse q, String label, List<String> errors) {
        if (q.getType() == null) {
            errors.add(label + "문제 유형이 없습니다.");
            return null;
        }
        if (!StringUtils.hasText(q.getQuestionText())) {
            errors.add(label + "문제 내용이 없습니다.");
        }
        String answer = q.getCorrectAnswer();
        if (!StringUtils.hasText(answer)) {
            errors.add(label + "정답이 없습니다.");
            return null;
        }
        if (answer.length() > MAX_COLUMN_LENGTH) {
            errors.add(label + "정답이 " + MAX_COLUMN_LENGTH + "자를 초과합니다.");
            return null;
        }

        return switch (q.getType()) {
            case MULTIPLE_CHOICE -> resolveMultipleChoiceAnswer(q, label, errors);
            case OX -> resolveOxAnswer(answer, label, errors);
            case SHORT_ANSWER -> answer;
        };
    }

    // 결과 화면의 정답 표시는 보기와 정확히 일치해야 하므로, 정규화 기준으로 일치하는 보기의 원문을 정답으로 쓴다.
    private String resolveMultipleChoiceAnswer(QuestionResponse q, String label, List<String> errors) {
        List<String> options = q.getOptions();
        if (options == null || options.size() < MIN_MULTIPLE_CHOICE_OPTIONS) {
            errors.add(label + "객관식 보기가 " + MIN_MULTIPLE_CHOICE_OPTIONS + "개 미만입니다.");
            return null;
        }

        Set<String> normalizedOptions = new HashSet<>();
        for (String option : options) {
            if (!StringUtils.hasText(option) || !normalizedOptions.add(normalize(option))) {
                errors.add(label + "객관식 보기가 비어 있거나 중복됩니다.");
                return null;
            }
        }

        String normalizedAnswer = normalize(q.getCorrectAnswer());
        return options.stream()
                .filter(option -> normalize(option).equals(normalizedAnswer))
                .findFirst()
                .orElseGet(() -> {
                    errors.add(label + "객관식 정답이 보기 중에 없습니다.");
                    return null;
                });
    }

    private String resolveOxAnswer(String answer, String label, List<String> errors) {
        String upper = answer.trim().toUpperCase();
        if (!upper.equals("O") && !upper.equals("X")) {
            errors.add(label + "OX 정답은 O 또는 X여야 합니다.");
            return null;
        }
        return upper;
    }

    private boolean isVerifiedSource(QuestionResponse q, Map<Long, Set<String>> allowedSources) {
        if (q.getSourceNoteId() == null || q.getSourceBlockId() == null) {
            return false;
        }
        Set<String> blockIds = allowedSources.get(q.getSourceNoteId());
        return blockIds != null && blockIds.contains(q.getSourceBlockId());
    }

    private String normalizeTitle(String title) {
        if (!StringUtils.hasText(title)) {
            return DEFAULT_TITLE;
        }
        String trimmed = title.trim();
        return trimmed.length() > MAX_COLUMN_LENGTH ? trimmed.substring(0, MAX_COLUMN_LENGTH) : trimmed;
    }

    private static String normalize(String value) {
        return value.trim().toLowerCase();
    }
}
