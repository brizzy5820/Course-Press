import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen, LogOut, Trash2, ChevronRight, ChevronDown,
  CheckCircle2, Pencil, X, User,
  ArrowRight, GraduationCap, Clock, Search, Sun, Moon, ArrowLeft,
} from 'lucide-react'
import {
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  updateProfile,
} from 'firebase/auth'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useToast } from '../contexts/ToastContext'
import { listMyEnrollments, getCourse, getProgress, flattenLessons } from '../lib/data'
import TopNav from '../components/TopNav'
import AccountPanel from '../components/AccountPanel'

// Normalize Nigerian phone numbers: +234/234 prefix → 0 prefix
function normalizePhone(raw) {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('234') && digits.length >= 13) {
    digits = '0' + digits.slice(3)
  }
  return digits
}

export default function Dashboard() {
  const { user, profile, logout } = useAuth()
  const { theme, toggleTheme }    = useTheme()
  const toast                     = useToast()
  const navigate                  = useNavigate()
  const [items,       setItems]       = useState(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [filter,      setFilter]      = useState('all')
  const [query,       setQuery]       = useState('')

  useEffect(() => {
    if (!user) return
    listMyEnrollments(user.uid).then(async enrollments => {
      const withCourses = await Promise.all(
        enrollments.map(async e => {
          const course    = await getCourse(e.courseId)
          const progress  = await getProgress(user.uid, e.courseId)
          const lessons   = flattenLessons(course)
          const total     = lessons.length
          const completed = progress.completedLessonIds.length
          return {
            course,
            percent:   total ? Math.round((completed / total) * 100) : 0,
            completed,
            total,
          }
        })
      )
      setItems(withCourses.filter(i => i.course))
    })
  }, [user])

  async function handleLogout() {
    await logout()
    toast('You\'ve been signed out.', 'info')
  }

  const initials = (profile?.name || user?.email || '?')
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const counts = useMemo(() => {
    if (!items) return { all: 0, active: 0, done: 0 }
    return {
      all:    items.length,
      active: items.filter(i => i.percent > 0 && i.percent < 100).length,
      done:   items.filter(i => i.percent === 100).length,
    }
  }, [items])

  const visible = useMemo(() => {
    if (!items) return []
    return items
      .filter(i => filter === 'active' ? (i.percent > 0 && i.percent < 100)
                 : filter === 'done'   ? i.percent === 100
                 : true)
      .filter(i => i.course.title.toLowerCase().includes(query.trim().toLowerCase()))
  }, [items, filter, query])

  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-neutral-950">
      <TopNav />

      {/* ── Header ── */}
      <header className="hidden bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm border-b border-neutral-200 dark:border-neutral-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back arrow */}
            {window.history.length > 1 && (
              <button
                onClick={() => window.history.back()}
                aria-label="Go back"
                className="flex items-center justify-center h-8 w-8 rounded-full text-neutral-500 dark:text-neutral-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <Link to="/" className="flex items-center gap-2.5">
              <span className="font-bold text-neutral-950 dark:text-white text-[17px] tracking-tight">
                CoursePress
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-1">
            <Link
              to="/"
              className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <BookOpen className="h-4 w-4" /> Browse
            </Link>
            <button
              onClick={() => setAccountOpen(true)}
              className="flex items-center gap-2 rounded-full border border-neutral-200 dark:border-neutral-700 pl-3 pr-1.5 py-1.5 hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-white dark:hover:bg-neutral-800 transition group ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
            >
              <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300 max-w-[160px] truncate hidden sm:block group-hover:text-neutral-900 dark:group-hover:text-white transition">
                {profile?.name || user?.email}
              </span>
              <div className="h-7 w-7 rounded-full bg-black text-white dark:bg-amber-500 dark:text-black flex items-center justify-center text-xs font-semibold shrink-0">
                {initials}
              </div>
              {/* Chevron collapse indicator */}
              <ChevronDown className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Page ── */}
      <main className="max-w-5xl mx-auto px-6 py-10 lg:py-14">

        {/* Page title + search */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber-600 mb-2">library</p>
            <h1 className="text-2xl font-semibold text-neutral-950 dark:text-white tracking-tight">
              {items?.length ? 'Continue learning' : 'My library'}
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1.5">
              {items === null
                ? ''
                : items.length === 0
                ? 'Nothing enrolled yet — your courses will show up here.'
                : `${items.length} course${items.length !== 1 ? 's' : ''} · ${counts.done} completed`}
            </p>
          </div>

          {items && items.length > 0 && (
            <div className="relative w-full sm:w-56">
              <Search className="h-3.5 w-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search your courses"
                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg pl-9 pr-3 py-2 text-sm text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-50 dark:focus:ring-amber-900/20 transition"
              />
            </div>
          )}
        </div>

        {/* Filter tabs */}
        {items && items.length > 0 && (
          <div className="flex items-center gap-1.5 mb-6">
            <Tab label="All"          count={counts.all}    active={filter === 'all'}    onClick={() => setFilter('all')} />
            <Tab label="In progress"  count={counts.active} active={filter === 'active'} onClick={() => setFilter('active')} />
            <Tab label="Completed"    count={counts.done}   active={filter === 'done'}   onClick={() => setFilter('done')} />
          </div>
        )}

        {/* Loading */}
        {items === null && (
           <div className="grid gap-6 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <CourseCardSkeleton key={index} />
              ))}
            </div>
        )}

        {/* Empty library */}
        {items?.length === 0 && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="h-7 w-7 text-amber-500" />
            </div>
            <p className="font-semibold text-lg text-neutral-900 dark:text-white">No courses in your library</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5">Browse the catalog and enroll to get started.</p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 mt-6 bg-black dark:bg-amber-500 text-white dark:text-black rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-neutral-800 dark:hover:bg-amber-400 transition"
            >
              Browse courses <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* No search/filter results */}
        {items && items.length > 0 && visible.length === 0 && (
          <div className="text-center py-24">
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              {query ? `No courses match "${query}".` : 'Nothing here yet.'}
            </p>
          </div>
        )}

        {/* Course grid */}
        {visible.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            {visible.map(({ course, percent, completed, total }) => (
              <CourseCard
                key={course.id}
                course={course}
                percent={percent}
                completed={completed}
                total={total}
              />
            ))}
          </div>
        )}
      </main>

      {/* Account panel */}
      <AccountPanel
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        user={user}
        profile={profile}
        onLogout={handleLogout}
        navigate={navigate}
        toast={toast}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    </div>
  )
}

// ── Filter tab ────────────────────────────────────────────────────────────────

function Tab({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40
        ${active
          ? 'bg-black dark:bg-amber-500 text-white dark:text-black'
          : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
    >
      {label}
      <span className="text-[11px] tabular-nums text-current opacity-60">{count}</span>
    </button>
  )
}
function CourseCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200/70 bg-white/85 shadow-sm dark:border-amber-400/10 dark:bg-neutral-900/85">
      <div className="skeleton-shimmer aspect-[16/9] bg-zinc-100/70 dark:bg-neutral-800" />

      <div className="p-5">
        <div className="skeleton-shimmer h-6 w-4/5 rounded-md bg-neutral-200 dark:bg-neutral-800" />
        <div className="mt-2 space-y-2">
          <div className="skeleton-shimmer h-3.5 w-full rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="skeleton-shimmer h-3.5 w-2/3 rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="skeleton-shimmer h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="skeleton-shimmer h-5 w-16 rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-amber-100 pt-4 dark:border-amber-400/10">
          <div className="skeleton-shimmer h-4 w-20 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="skeleton-shimmer h-4 w-4 rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>
      </div>
    </div>
  )
}
// ── Course card ──────────────────────────────────────────────────────────────

function CourseCard({ course, percent, completed, total }) {
  const isComplete = percent === 100
  const isStarted  = percent > 0

  return (
    <Link
      to={`/courses/${course.id}`}
      className="group bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.14)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col"
    >
      {/* Cover */}
      <div className="aspect-[16/9] bg-neutral-100 dark:bg-neutral-800 overflow-hidden relative">
        {course.coverImage ? (
          <img
            src={course.coverImage}
            alt={course.title}
            className="h-full w-full object-cover group-hover:scale-[1.04] transition duration-700 ease-out"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <BookOpen className="h-9 w-9 text-neutral-300 dark:text-neutral-600" />
          </div>
        )}
        {isComplete && (
          <div className="absolute top-3 right-3 bg-emerald-600 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
            <CheckCircle2 className="h-3 w-3" /> Complete
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-semibold text-neutral-950 dark:text-white text-[16px] leading-snug line-clamp-2">
          {course.title}
        </h3>
        {course.subtitle && (
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-1">{course.subtitle}</p>
        )}

        <div className="mt-auto pt-4">
          {/* Stats row */}
          <div className="flex items-center gap-4 mb-3 text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              {total} lessons
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {completed} done
            </span>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-neutral-400 font-medium">
                {isComplete ? 'Completed' : isStarted ? 'In progress' : 'Not started'}
              </span>
              <span className={`text-xs font-semibold font-mono tabular-nums
                ${isComplete ? 'text-emerald-600' : isStarted ? 'text-amber-600' : 'text-neutral-400'}`}>
                {percent}%
              </span>
            </div>
            <div className="h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700
                  ${isComplete ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* CTA row */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <span className="text-xs font-semibold text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white transition">
            {isComplete ? 'Review course' : isStarted ? 'Continue' : 'Start learning'}
          </span>
          <ChevronRight className="h-4 w-4 text-neutral-300 group-hover:text-amber-500 group-hover:translate-x-0.5 transition" />
        </div>
      </div>
    </Link>
  )
}

// Account panel moved to shared component: src/components/AccountPanel.jsx
