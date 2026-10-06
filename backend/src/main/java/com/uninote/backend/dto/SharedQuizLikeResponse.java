package com.uninote.backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SharedQuizLikeResponse {
    private boolean liked;
    private long likeCount;
}
