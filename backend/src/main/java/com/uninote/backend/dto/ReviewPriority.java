package com.uninote.backend.dto;

// 복습 우선순위 등급. 실제 정렬 순서는 IncorrectNoteService의 PRIORITY_ORDER가 결정하며,
// 이 값은 UI 배지/필터링용으로 노출되는 등급 라벨이다.
public enum ReviewPriority {
    HIGH, MEDIUM, LOW
}
