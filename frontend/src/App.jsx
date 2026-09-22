import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import { useAuth } from './context/AuthContext';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CourseDetailPage = lazy(() => import('./pages/CourseDetailPage'));
const QuizLibraryPage = lazy(() => import('./pages/QuizLibraryPage'));
const IncorrectNotesPage = lazy(() => import('./pages/IncorrectNotesPage'));

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Router>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
          <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/course/:courseId" element={<CourseDetailPage />} />
            <Route path="/course/:courseId/note/:noteId" element={<CourseDetailPage />} />
            <Route path="/quizzes" element={<QuizLibraryPage />} />
            <Route path="/incorrect-notes" element={<IncorrectNotesPage />} />
            <Route path="/incorrect-notes/groups" element={<IncorrectNotesPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
