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
    // 유형당 1~20개. QuizService.MAX_QUESTIONS_PER_TYPE, QuizConfigModal의 상한과 같게 유지한다.
    @NotEmpty
    private Map<QuestionType, @Min(1) @Max(20) Integer> typeCounts;
    @NotNull
    private QuizDifficulty difficulty;
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
