import { useEffect, useState, useRef } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import CourseDetail from './pages/CourseDetail'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CoursePlayer from './pages/CoursePlayer'
import AdminDashboard from './pages/admin/AdminDashboard'
import CourseEditor from './pages/admin/CourseEditor'
import { ProtectedRoute, AdminRoute } from './components/Guards'
import { ToastProvider } from './contexts/ToastContext'
import Preloader from './components/Preloader'

function RoutePreloader() {
  const location = useLocation()
  const [show, setShow] = useState(false)
  const timeoutRef = useRef(null)
  const frameRef = useRef(null)

  useEffect(() => {
    // Clear any pending operations
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (frameRef.current) cancelAnimationFrame(frameRef.current)

    // Use requestAnimationFrame to ensure DOM is ready before showing preloader
    frameRef.current = requestAnimationFrame(() => {
      setShow(true)
      timeoutRef.current = window.setTimeout(() => {
        setShow(false)
      }, 520)
    })

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [location.pathname, location.search])

  return show ? <Preloader label="Loading page" /> : null
}

export default function App() {
  return (
    <ToastProvider>
      <RoutePreloader />
      <Routes>
        <Route path="/"                    element={<Home />} />
        <Route path="/courses/:courseId"   element={<CourseDetail />} />
        <Route path="/login"               element={<Login />} />

        <Route path="/dashboard"
          element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/dashboard/:courseId"
          element={<ProtectedRoute><CoursePlayer /></ProtectedRoute>} />

        <Route path="/admin"
          element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/courses/:courseId"
          element={<AdminRoute><CourseEditor /></AdminRoute>} />

        <Route path="*" element={<Home />} />
      </Routes>
    </ToastProvider>
  )
}
