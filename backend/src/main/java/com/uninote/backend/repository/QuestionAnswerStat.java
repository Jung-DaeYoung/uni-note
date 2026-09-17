package com.uninote.backend.repository;

import com.uninote.backend.domain.QuestionType;

import java.time.LocalDateTime;

// 학생 한 명의 문제별 풀이 이력을 집계하기 위한 projection.
// 오답 통계(전체/강의별/유형별/문제별)와 오늘의 복습 후보 선정이 모두 이 한 번의
// GROUP BY 쿼리 결과를 공유해, 서로 다른 집계 쿼리에서 숫자가 어긋나는 일을 막는다.
public interface QuestionAnswerStat {
    Long getQuestionId();
    Long getCourseId();       // 문제의 퀴즈 세트에 강의가 없으면 null
    String getCourseName();
    QuestionType getType();
    Long getAttemptCount();
    Long getCorrectCount();
    Long getIncorrectCount();
    LocalDateTime getLastAttemptedAt();
    LocalDateTime getLastIncorrectAt(); // 한 번도 틀린 적 없으면 null
}
