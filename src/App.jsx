import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import CourseDetail from './pages/CourseDetail'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CoursePlayer from './pages/CoursePlayer'
import AdminDashboard from './pages/admin/AdminDashboard'
import CourseEditor from './pages/admin/CourseEditor'
import { ProtectedRoute, AdminRoute } from './components/Guards'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/courses/:courseId" element={<CourseDetail />} />
      <Route path="/login" element={<Login />} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/dashboard/:courseId" element={<ProtectedRoute><CoursePlayer /></ProtectedRoute>} />

      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/courses/:courseId" element={<AdminRoute><CourseEditor /></AdminRoute>} />

      <Route path="*" element={<Home />} />
    </Routes>
  )
}
