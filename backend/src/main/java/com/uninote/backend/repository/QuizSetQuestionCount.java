package com.uninote.backend.repository;

// 퀴즈 세트별 문제 수를 배치로 조회하기 위한 projection.
// 풀이 기록 목록에서 quizSet.getQuestions().size()를 세트마다 호출하면 N+1이 발생하므로,
// 필요한 개수만 한 번의 GROUP BY 쿼리로 가져온다.
public interface QuizSetQuestionCount {
    Long getQuizSetId();
    Long getCount();
}
