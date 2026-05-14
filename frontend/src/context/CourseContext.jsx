import React, { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';
import { useAuth } from './AuthContext';

const CourseContext = createContext({
  courses: [],
  isLoading: false,
  refreshCourses: () => {}
});

export const useCourses = () => useContext(CourseContext);

export const CourseProvider = ({ children }) => {
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated } = useAuth();

  const fetchCourses = async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const response = await client.get('/dashboard/courses');
      setCourses(response.data.courses || []);
    } catch (error) {
      console.error("강의 목록 로딩 실패", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [isAuthenticated]);

  return (
    <CourseContext.Provider value={{ courses, isLoading, refreshCourses: fetchCourses }}>
      {children}
    </CourseContext.Provider>
  );
};
