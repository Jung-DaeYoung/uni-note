package com.uninote.backend.repository;

import com.uninote.backend.domain.IncorrectNoteItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface IncorrectNoteItemRepository extends JpaRepository<IncorrectNoteItem, Long> {
    Optional<IncorrectNoteItem> findByGroup_IdAndQuestion_QuestionId(Long groupId, Long questionId);

    // 퀴즈 삭제 시 해당 퀴즈의 문제를 참조하는 오답노트 항목을 먼저 지워 FK 제약 위반을 막는다.
    void deleteByQuestion_QuizSet_QuizSetId(Long quizSetId);
}
