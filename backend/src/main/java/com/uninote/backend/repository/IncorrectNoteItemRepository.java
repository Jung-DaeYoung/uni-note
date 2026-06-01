package com.uninote.backend.repository;

import com.uninote.backend.domain.IncorrectNoteItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface IncorrectNoteItemRepository extends JpaRepository<IncorrectNoteItem, Long> {
    Optional<IncorrectNoteItem> findByGroup_IdAndQuestion_QuestionId(Long groupId, Long questionId);
}
