import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Award, BookOpen, CheckCircle2, GraduationCap,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  listMyEnrollments, getCourse, getProgress, flattenLessons,
} from '../lib/data'
import CertificateModal, { hasCertificate } from '../components/CertificateModal'
import Preloader from '../components/Preloader'
import TopNav from '../components/TopNav'

/**
 * Student's certificate shelf: every finished course that has a certificate
 * template uploaded by the creator. Preview and download (PNG/PDF) reuse the
 * same renderer as in-course, with the name taken from the student's profile.
 */
export default function Certificates() {
  const { user, profile } = useAuth()
  const [items,   setItems]   = useState(null)
  const [active,  setActive]  = useState(null)

  // The name printed on the certificate comes from the account/dashboard name.
  const name = profile?.name || user?.displayName || user?.email?.split('@')[0] || 'Student'

  useEffect(() => {
    if (!user) return
    let alive = true
    listMyEnrollments(user.uid).then(async enrollments => {
      const rows = await Promise.all(
        enrollments.map(async e => {
          const course = await getCourse(e.courseId)
          if (!course) return null
          const progress = await getProgress(user.uid, e.courseId)
          const lessons  = flattenLessons(course)
          const ids      = lessons.map(l => l.id)
          const done     = (progress.completedLessonIds || []).filter(id => ids.includes(id)).length
          const total    = ids.length
          const percent  = total ? Math.round((done / total) * 100) : 0
          return { course, percent, completed: done, total }
        })
      )
      if (!alive) return
      // Only finished courses whose creator published a certificate template.
      setItems(
        rows
          .filter(Boolean)
          .filter(i => i.total > 0 && i.percent === 100 && hasCertificate(i.course))
      )
    })
    return () => { alive = false }
  }, [user])

  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-neutral-950">
      <TopNav />

      <main className="max-w-5xl mx-auto px-6 py-10 lg:py-14">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Library
          </Link>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber-600 mb-2">achievements</p>
          <h1 className="text-2xl font-semibold text-neutral-950 dark:text-white tracking-tight">
            My certificates
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1.5">
            {items === null
              ? ''
              : items.length === 0
              ? 'Finish every lesson in a course to earn its certificate.'
              : `${items.length} certificate${items.length !== 1 ? 's' : ''} earned — printed with the name on your account (${name}).`}
          </p>
        </div>

        {/* Loading */}
        {items === null && (
          <div className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
                <div className="aspect-[16/9] bg-neutral-100 dark:bg-neutral-800" />
                <div className="p-5 space-y-3">
                  <div className="h-5 w-2/3 rounded bg-neutral-100 dark:bg-neutral-800" />
                  <div className="h-10 w-full rounded-lg bg-neutral-100 dark:bg-neutral-800" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {items?.length === 0 && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="h-7 w-7 text-amber-500" />
            </div>
            <p className="font-semibold text-lg text-neutral-900 dark:text-white">No certificates yet</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5">
              Complete all lessons in a course and its certificate shows up here.
            </p>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 mt-6 bg-black dark:bg-amber-500 text-white dark:text-black rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-neutral-800 dark:hover:bg-amber-400 transition"
            >
              <BookOpen className="h-4 w-4" /> Go to my library
            </Link>
          </div>
        )}

        {/* Certificate grid */}
        {items && items.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            {items.map(({ course }) => (
              <article
                key={course.id}
                className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.14)] transition-all duration-300 flex flex-col"
              >
                <div className="aspect-[16/9] bg-neutral-100 dark:bg-neutral-800 overflow-hidden relative">
                  {course.coverImage ? (
                    <img src={course.coverImage} alt={course.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Award className="h-9 w-9 text-neutral-300 dark:text-neutral-600" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3 bg-emerald-600 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                    <CheckCircle2 className="h-3 w-3" /> Earned
                  </div>
                </div>

                <div className="p-5 flex flex-col flex-1">
                  <h2 className="font-semibold text-neutral-950 dark:text-white text-[16px] leading-snug line-clamp-2">
                    {course.title}
                  </h2>
                  <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1">
                    Certificate of completion
                  </p>

                  <div className="mt-auto pt-5">
                    <button
                      type="button"
                      onClick={() => setActive(course)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 transition"
                    >
                      <Award className="h-4 w-4" /> View &amp; download
                    </button>
                    <Link
                      to={`/courses/${course.id}`}
                      className="mt-3 block text-center text-xs font-semibold text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition"
                    >
                      Review course
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {active && (
        <CertificateModal
          open
          course={active}
          name={name}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  )
}
