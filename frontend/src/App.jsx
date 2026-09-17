import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import { useAuth } from './context/AuthContext';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CourseDetailPage = lazy(() => import('./pages/CourseDetailPage'));
const QuizLibraryPage = lazy(() => import('./pages/QuizLibraryPage'));

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Router>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
          <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/course/:courseId"
            element={
              <ProtectedRoute>
                <CourseDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/course/:courseId/note/:noteId"
            element={
              <ProtectedRoute>
                <CourseDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quizzes"
            element={
              <ProtectedRoute>
                <QuizLibraryPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
