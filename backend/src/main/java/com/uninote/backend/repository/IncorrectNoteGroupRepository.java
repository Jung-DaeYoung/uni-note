package com.uninote.backend.repository;

import com.uninote.backend.domain.IncorrectNoteGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface IncorrectNoteGroupRepository extends JpaRepository<IncorrectNoteGroup, Long> {
    List<IncorrectNoteGroup> findByStudent_StudId(Long studId);
    Optional<IncorrectNoteGroup> findByStudent_StudIdAndTitle(Long studId, String title);
}
