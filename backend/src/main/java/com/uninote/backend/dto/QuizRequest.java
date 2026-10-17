package com.uninote.backend.dto;

import com.uninote.backend.domain.QuestionType;
import com.uninote.backend.domain.QuizDifficulty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class QuizRequest {
    @NotEmpty
    private List<@Positive Long> noteIds;
    // 유형당 1~20개. QuizConfigModal의 MAX_QUESTIONS_PER_TYPE와 같게 유지한다.
    @NotEmpty
    private Map<QuestionType, @NotNull @Min(1) @Max(20) Integer> typeCounts;
    @NotNull
    private QuizDifficulty difficulty;

    // 선택 필드. 문항이 평가할 학습 목표를 프롬프트에 넣는다. 생략하거나 비어 있으면 기존과 같다.
    // QuizConfigModal의 MAX_LEARNING_OBJECTIVES / MAX_OBJECTIVE_LENGTH와 같게 유지한다.
    @Size(max = 5)
    private List<@NotBlank @Size(max = 100) String> learningObjectives;

    // 선택 필드. 자주 틀린 개념(개념별 통계의 conceptTag)을 중심으로 출제한다(P2-4).
    // 길이는 개념 태그 정규화 상한(QuizQualityValidator.MAX_CONCEPT_TAG_LENGTH)과 같다.
    @Size(max = 5)
    private List<@NotBlank @Size(max = 30) String> focusConcepts;
    // 선택 필드. 노트별로 블록(과 하위 블록)만 문제 범위로 쓴다. 여기 없는 noteIds의 노트는
    // 노트 전체를 사용하며, 생략하거나 비어 있으면 모든 노트를 전체로 쓴다.
    // noteId는 noteIds에 포함되어야 한다(QuizService에서 검증).
    @Valid
    @Size(max = 20)
    private List<BlockSelection> blockSelections;

    @Data
    public static class BlockSelection {
        @NotNull
        @Positive
        private Long noteId;
        @NotEmpty
        @Size(max = 500)
        private List<@NotBlank String> blockIds;
    }
}
