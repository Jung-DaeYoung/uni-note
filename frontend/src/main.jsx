import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { CourseProvider } from './context/CourseContext'
import { ThemeProvider } from './context/ThemeContext'
import { ConfirmProvider } from './context/ConfirmContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <ConfirmProvider>
        <AuthProvider>
          <CourseProvider>
            <App />
          </CourseProvider>
        </AuthProvider>
      </ConfirmProvider>
    </ThemeProvider>
  </StrictMode>,
)
