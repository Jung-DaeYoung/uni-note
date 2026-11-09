import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import { useCourses } from './context/CourseContext';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CourseDetailPage = lazy(() => import('./pages/CourseDetailPage'));
const QuizLibraryPage = lazy(() => import('./pages/QuizLibraryPage'));
const IncorrectNotesPage = lazy(() => import('./pages/IncorrectNotesPage'));
const SharedQuizBoardPage = lazy(() => import('./pages/SharedQuizBoardPage'));
const SharedNoteBoardPage = lazy(() => import('./pages/SharedNoteBoardPage'));
const MyPage = lazy(() => import('./pages/MyPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));

// 경로별 탭 제목(WCAG 2.4.2). 강의 페이지는 강의 이름을 쓴다.
const PAGE_TITLES = [
  ['/login', '로그인'],
  ['/dashboard', '강의목록'],
  ['/quizzes', '나의 CBT 시험'],
  ['/shared-quizzes', 'CBT 시험 공유게시판'],
  ['/shared-notes', '노트 공유 게시판'],
  ['/incorrect-notes', '오답노트'],
  ['/mypage', '마이페이지'],
  ['/search', '검색'],
];

const PageTitle = () => {
  const { pathname } = useLocation();
  const { courses } = useCourses();

  useEffect(() => {
    const courseId = pathname.match(/^\/course\/(\d+)/)?.[1];
    const page = courseId
      ? courses.find(c => String(c.courseId) === courseId)?.courseName ?? '강의'
      : PAGE_TITLES.find(([path]) => pathname.startsWith(path))?.[1];
    document.title = page ? `${page} · UniNote` : 'UniNote';
  }, [pathname, courses]);

  return null;
};

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Router>
      <PageTitle />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
          <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/course/:courseId" element={<CourseDetailPage />} />
            <Route path="/course/:courseId/note/:noteId" element={<CourseDetailPage />} />
            <Route path="/quizzes" element={<QuizLibraryPage />} />
            <Route path="/shared-quizzes" element={<SharedQuizBoardPage />} />
            <Route path="/shared-notes" element={<SharedNoteBoardPage />} />
            <Route path="/shared-notes/:postId" element={<SharedNoteBoardPage />} />
            <Route path="/incorrect-notes" element={<IncorrectNotesPage />} />
            <Route path="/incorrect-notes/groups" element={<IncorrectNotesPage />} />
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/search" element={<SearchPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
