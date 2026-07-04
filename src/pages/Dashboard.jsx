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
          <Link to="/" className="font-display text-xl font-semibold">CoursePress</Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-ash">{profile?.name || user?.email}</span>
            <button onClick={logout} className="hover:text-goldDeep">Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl font-semibold mb-8">My library</h1>

        {items === null && <p className="text-ash">Loading…</p>}
        {items?.length === 0 && (
          <div className="border border-dashed border-ink/15 rounded-xl p-10 text-center text-ash">
            No courses yet. <Link to="/" className="inline-flex items-center gap-2 text-goldDeep font-medium">Browse the catalog <ArrowRight className="h-4 w-4" /></Link>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-5">
          {items?.map(({ course, percent }) => (
            <Link
              key={course.id}
              to={`/dashboard/${course.id}`}
              className="block border border-ink/10 rounded-xl p-5 bg-white hover:border-goldDeep/40 transition"
            >
              <h3 className="font-display text-lg font-semibold">{course.title}</h3>
              <div className="mt-4 h-1.5 rounded-full bg-parchment overflow-hidden">
                <div className="h-full bg-sage" style={{ width: `${percent}%` }} />
              </div>
              <p className="text-xs text-ash mt-2 font-mono">{percent}% complete</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
