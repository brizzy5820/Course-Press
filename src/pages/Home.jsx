import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCourses, flattenLessons } from '../lib/data'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

/* ─── Subtle background decorations ─────────────────────────────────────── */
function BackgroundCanvas() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {/* Soft dot-grid pattern */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.035]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="dot-grid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.5" fill="#1a1a2e" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-grid)" />
      </svg>

      {/* Top-left ambient orb */}
      <div
        className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full"
        style={{
          background: 'radial-gradient(circle at 40% 40%, rgba(99,102,241,0.09) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Top-right warm orb */}
      <div
        className="absolute -top-20 right-0 w-[420px] h-[420px] rounded-full"
        style={{
          background: 'radial-gradient(circle at 60% 30%, rgba(251,191,36,0.07) 0%, transparent 65%)',
          filter: 'blur(50px)',
        }}
      />

      {/* Mid-page cool orb */}
      <div
        className="absolute top-[45%] -right-40 w-[500px] h-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle at 70% 50%, rgba(14,165,233,0.06) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Bottom-left lavender orb */}
      <div
        className="absolute bottom-0 -left-20 w-[480px] h-[480px] rounded-full"
        style={{
          background: 'radial-gradient(circle at 30% 70%, rgba(139,92,246,0.07) 0%, transparent 65%)',
          filter: 'blur(50px)',
        }}
      />

      {/* Diagonal faint line accent — top right */}
      <svg
        className="absolute top-24 right-24 opacity-[0.045] hidden sm:block"
        width="220" height="220" viewBox="0 0 220 220"
        fill="none" xmlns="http://www.w3.org/2000/svg"
      >
        {[0, 20, 40, 60, 80, 100].map((offset) => (
          <line
            key={offset}
            x1={offset} y1="0"
            x2="220" y2={220 - offset}
            stroke="#64748b" strokeWidth="1"
          />
        ))}
      </svg>

      {/* Diagonal faint line accent — bottom left */}
      <svg
        className="absolute bottom-24 left-16 opacity-[0.04] hidden sm:block"
        width="160" height="160" viewBox="0 0 160 160"
        fill="none" xmlns="http://www.w3.org/2000/svg"
      >
        {[0, 22, 44, 66].map((offset) => (
          <line
            key={offset}
            x1="0" y1={offset}
            x2={160 - offset} y2="160"
            stroke="#64748b" strokeWidth="1"
          />
        ))}
      </svg>

      {/* Faint arc ring — hero area */}
      <svg
        className="absolute top-8 left-1/2 -translate-x-1/2 opacity-[0.04] hidden md:block"
        width="700" height="340" viewBox="0 0 700 340"
        fill="none" xmlns="http://www.w3.org/2000/svg"
      >
        <ellipse cx="350" cy="0" rx="340" ry="280" stroke="#6366f1" strokeWidth="1" />
        <ellipse cx="350" cy="0" rx="290" ry="230" stroke="#6366f1" strokeWidth="0.6" />
      </svg>

      {/* Subtle top gradient fade */}
      <div
        className="absolute inset-x-0 top-0 h-64"
        style={{
          background: 'linear-gradient(to bottom, rgba(237,233,254,0.18) 0%, transparent 100%)',
        }}
      />

      {/* Subtle bottom gradient fade */}
      <div
        className="absolute inset-x-0 bottom-0 h-48"
        style={{
          background: 'linear-gradient(to top, rgba(224,242,254,0.12) 0%, transparent 100%)',
        }}
      />
    </div>
  )
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
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
    <div className="min-h-screen bg-[#F7F8FA] relative">
      <BackgroundCanvas />

      {/* Everything else sits above the background */}
      <div className="relative z-10">
        <header className="bg-white/80 backdrop-blur-sm border-b border-zinc-200/70">
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
          <h1 className="font-sans text-3xl lg:text-4xl font-semibold leading-tight max-w-2xl text-black">
            Courses that builds careers
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
    </div>
  )
}

/* ─── Course card ────────────────────────────────────────────────────────── */
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
