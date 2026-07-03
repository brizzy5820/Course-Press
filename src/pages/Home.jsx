import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCourses, flattenLessons } from '../lib/data'
import { useAuth } from '../contexts/AuthContext'

export default function Home() {
  const [courses, setCourses] = useState(null)
  const { user, logout } = useAuth()

  useEffect(() => {
    listCourses({ onlyPublished: true }).then(setCourses)
  }, [])

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-ink/10">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="font-display text-xl font-semibold tracking-tight">
            CoursePress
          </Link>
          {user ? (
            <div className="flex items-center gap-4 text-sm">
              <Link to="/dashboard" className="font-medium hover:text-goldDeep">My library</Link>
              <button onClick={logout} className="text-ash hover:text-ink">Sign out</button>
            </div>
          ) : (
            <Link to="/login" className="text-sm font-medium hover:text-goldDeep">Sign in</Link>
          )}
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 pt-16 pb-10">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-goldDeep mb-4">
          Self-paced &middot; lifetime access
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-tight max-w-2xl">
          Courses you can actually finish.
        </h1>
        <p className="mt-4 text-ash max-w-xl text-lg">
          Pick a course, see exactly what's inside before you buy, and get instant
          access the moment payment clears.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24">
        {courses === null && <p className="text-ash">Loading courses…</p>}
        {courses?.length === 0 && (
          <div className="border border-dashed border-ink/15 rounded-xl p-10 text-center text-ash">
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
      className="group block rounded-2xl border border-ink/10 bg-white overflow-hidden hover:border-goldDeep/40 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)] transition"
    >
      <div className="aspect-[16/9] bg-parchment overflow-hidden">
        {course.coverImage ? (
          <img src={course.coverImage} alt="" className="h-full w-full object-cover group-hover:scale-105 transition duration-500" />
        ) : (
          <div className="h-full w-full flex items-center justify-center font-display text-3xl text-ash/40">
            {course.title?.[0] || '?'}
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-display text-xl font-semibold leading-snug">{course.title}</h3>
        <p className="text-sm text-ash mt-1 line-clamp-2">{course.subtitle}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="font-mono text-xs text-ash">{lessonCount} lessons</span>
          <span className="font-semibold text-goldDeep">
            {course.price ? `₦${Number(course.price).toLocaleString()}` : 'Free'}
          </span>
        </div>
      </div>
    </Link>
  )
}
