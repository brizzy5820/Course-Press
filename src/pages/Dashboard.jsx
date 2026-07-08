import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { listMyEnrollments, getCourse, getProgress, flattenLessons } from '../lib/data'

export default function Dashboard() {
  const { user, logout, profile } = useAuth()
  const [items, setItems] = useState(null)

  useEffect(() => {
    if (!user) return
    listMyEnrollments(user.uid).then(async enrollments => {
      const withCourses = await Promise.all(enrollments.map(async e => {
        const course = await getCourse(e.courseId)
        const progress = await getProgress(user.uid, e.courseId)
        const total = flattenLessons(course).length
        return { course, percent: total ? Math.round((progress.completedLessonIds.length / total) * 100) : 0 }
      }))
      setItems(withCourses.filter(i => i.course))
    })
  }, [user])

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-ink/10">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className=" text-xl font-semibold">CoursePress</Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-ash">{profile?.name || user?.email}</span>
            <button onClick={logout} className="hover:text-goldDeep">Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className=" text-3xl font-semibold mb-8">My library</h1>

        {items === null && <p className="text-ash">Loading…</p>}
        {items?.length === 0 && (
          <div className="border border-dashed border-ink/15 rounded-xl p-10 text-center text-ash">
            No courses yet. <Link to="/" className="inline-flex items-center gap-2 text-goldDeep font-medium">Browse the catalog <ArrowRight className="h-4 w-4" /></Link>
          </div>
        )}

       <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
  {items?.map(({ course, percent }) => (
    <Link
      key={course.id}
      to={`/dashboard/${course.id}`}
      className="group overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-goldDeep/30 hover:shadow-xl"
    >
      {/* Course Image */}
      <div className="relative h-52 overflow-hidden bg-parchment">
        <img
          src={course.coverImage}
          alt={course.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="font-display text-xl font-semibold text-ink line-clamp-2">
          {course.title}
        </h3>

        {course.description && (
          <p className="mt-2 text-sm leading-6 text-ash line-clamp-2">
            {course.description}
          </p>
        )}

        {/* Progress */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-ash">
              Progress
            </span>

            <span className="font-mono text-sm font-semibold text-sage">
              {percent}%
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-parchment">
            <div
              className="h-full rounded-full bg-sage transition-all duration-700"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  ))}
</div>
      </main>
    </div>
  )
}
