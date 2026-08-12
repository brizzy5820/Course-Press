import { useEffect, useState } from 'react'
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

  useEffect(() => {
    setShow(true)
    const timer = window.setTimeout(() => setShow(false), 520)
    return () => window.clearTimeout(timer)
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
