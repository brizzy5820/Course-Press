import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCourses, flattenLessons } from '../lib/data'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function Home() {
  const [courses, setCourses] = useState(null)
  const { user, logout }      = useAuth()
  const toast                 = useToast()

  useEffect(() => {
    listCourses({ onlyPublished: true }).then(setCourses)
  }, [])

  async function handleLogout() {
    await logout()
    toast('You\'ve been signed out.', 'info')
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="font-bold text-zinc-900 text-lg tracking-tight">
            CoursePress
          </Link>
          {user ? (
            <div className="flex items-center gap-4 text-sm">
              <Link to="/dashboard" className="font-medium hover:text-black">My library</Link>
              <button onClick={handleLogout} className="text-zinc-600 hover:text-black transition">
                Sign out
              </button>
            </div>
          ) : (
            <Link to="/login" className="text-sm font-medium hover:text-black transition">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 pt-16 pb-10">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">
          Self-paced &middot; lifetime access
        </p>
        <h1 className="font-sans text-4xl sm:text-5xl font-semibold leading-tight max-w-2xl text-black">
          Courses you can actually finish.
        </h1>
        <p className="mt-4 text-zinc-600 max-w-xl text-lg">
          Pick a course, see exactly what's inside before you buy, and get instant
          access the moment payment clears.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24">
        {courses === null && <p className="text-zinc-600">Loading courses…</p>}
        {courses?.length === 0 && (
          <div className="border border-dashed border-zinc-300 rounded-xl p-10 text-center text-zinc-500">
            No courses published yet. Check back soon.
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-6">
          {courses?.map(course => <CourseCard key={course.id} course={course} />)}
        </div>
      </section>
    </div>
  )
}

function CourseCard({ course }) {
  const lessonCount = flattenLessons(course).length
  return (
    <Link
      to={`/courses/${course.id}`}
      className="group block rounded-2xl border border-zinc-200 bg-white overflow-hidden hover:border-black hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)] transition"
    >
      <div className="aspect-[16/9] bg-white overflow-hidden">
        {course.coverImage ? (
          <img
            src={course.coverImage} alt=""
            className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center font-bold text-3xl text-zinc-300">
            {course.title?.[0] || '?'}
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="tracking-tight text-xl font-semibold leading-snug text-black">{course.title}</h3>
        <p className="text-sm text-zinc-600 mt-1 line-clamp-2">{course.subtitle}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="font-mono text-xs text-zinc-500">{lessonCount} lessons</span>
          <span className="font-semibold text-black">
            {course.price ? `₦${Number(course.price).toLocaleString()}` : 'Free'}
          </span>
        </div>
      </div>
    </Link>
  )
}