import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import client from '../api/client';
import { useAuth } from './AuthContext';

const CourseContext = createContext({
  courses: [],
  recentPosts: [],
  recentNotes: []
});

// Provider와 그 짝인 훅을 같은 파일에 두는 관례이며, 이 훅 하나만을 위해 파일을
// 분리하면 Context/Provider/훅 세 파일로 흩어져 오히려 추적하기 어려워진다.
// eslint-disable-next-line react-refresh/only-export-components
export const useCourses = () => useContext(CourseContext);

// 사이드바(courses)와 대시보드(courses+recentPosts+recentNotes)가
// 모두 같은 /dashboard/courses 응답을 필요로 하므로, 이 하나의 fetch를 공유해
// 대시보드 페이지 방문 시마다 동일한 요청이 중복 발생하지 않게 한다.
export const CourseProvider = ({ children }) => {
  const [courses, setCourses] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);
  const [recentNotes, setRecentNotes] = useState([]);
  const { isAuthenticated } = useAuth();

  // 인증 상태가 바뀔 때 대시보드 데이터를 새로 불러온다. signal은 React StrictMode(개발 모드)의
  // mount→cleanup→remount 이중 실행이나 빠른 재인증 시 이전 요청을 실제로 취소해, 중복 요청과
  // 늦게 도착한 응답의 상태 반영을 함께 막는다.
  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    client.get('/dashboard/courses', { signal: controller.signal })
      .then((response) => {
        setCourses(response.data.courses || []);
        setRecentPosts(response.data.recentPosts || []);
        setRecentNotes(response.data.recentNotes || []);
      })
      .catch((error) => {
        if (axios.isCancel(error)) return;
        console.error("강의 목록 로딩 실패", error);
      });
    return () => controller.abort();
  }, [isAuthenticated]);

  const value = useMemo(
    () => ({ courses, recentPosts, recentNotes }),
    [courses, recentPosts, recentNotes]
  );

  return <CourseContext.Provider value={value}>{children}</CourseContext.Provider>;
};
