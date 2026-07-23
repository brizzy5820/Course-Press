import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen, LogOut, Trash2, ChevronRight,
  CheckCircle2, Loader2, Pencil, X, User,
  ArrowRight, GraduationCap, Clock, Search,
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
import { useToast } from '../contexts/ToastContext'
import { listMyEnrollments, getCourse, getProgress, flattenLessons } from '../lib/data'

export default function Dashboard() {
  const { user, profile, logout } = useAuth()
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

  // Counts drive the filter tabs — purely presentational, no change to data fetching.
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
    <div className="min-h-screen bg-[#F7F8FA]">

      {/* ── Header ── */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className=" font-bold text-zinc-950 text-[17px] tracking-tight">
              CoursePress
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <Link
              to="/"
              className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition px-3 py-2 rounded-lg hover:bg-zinc-100"
            >
              <BookOpen className="h-4 w-4" /> Browse
            </Link>
            <button
              onClick={() => setAccountOpen(true)}
              className="flex items-center gap-2.5 rounded-full border border-zinc-200 pl-3 pr-1.5 py-1.5 hover:border-zinc-300 hover:bg-white transition group ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
            >
              <span className="text-sm font-medium text-zinc-600 max-w-[160px] truncate hidden sm:block group-hover:text-zinc-900 transition">
                {profile?.name || user?.email}
              </span>
              <div className="h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                {initials}
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* ── Page ── */}
      <main className="max-w-5xl mx-auto px-6 py-10 lg:py-14">

        {/* Page title + search */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-indigo-600 mb-2">library</p>
            <h1 className=" text-2xl font-semibold text-zinc-950 tracking-tight">
              {items?.length ? 'Continue learning' : 'My library'}
            </h1>
            <p className="text-zinc-500 text-sm mt-1.5">
              {items === null
                ? ''
                : items.length === 0
                ? 'Nothing enrolled yet — your courses will show up here.'
                : `${items.length} course${items.length !== 1 ? 's' : ''} · ${counts.done} completed`}
            </p>
          </div>

          {items && items.length > 0 && (
            <div className="relative w-full sm:w-56">
              <Search className="h-3.5 w-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search your courses"
                className="w-full bg-white border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition"
              />
            </div>
          )}
        </div>

        {/* Filter tabs — quick way to jump between all / in-progress / completed */}
        {items && items.length > 0 && (
          <div className="flex items-center gap-1.5 mb-6">
            <Tab label="All"          count={counts.all}    active={filter === 'all'}    onClick={() => setFilter('all')} />
            <Tab label="In progress"  count={counts.active} active={filter === 'active'} onClick={() => setFilter('active')} />
            <Tab label="Completed"    count={counts.done}   active={filter === 'done'}   onClick={() => setFilter('done')} />
          </div>
        )}

        {/* Loading */}
        {items === null && (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
          </div>
        )}

        {/* Empty library */}
        {items?.length === 0 && (
          <div className="bg-white border border-zinc-200 rounded-2xl p-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="h-7 w-7 text-indigo-500" />
            </div>
            <p className="font-serif font-semibold text-lg text-zinc-900">No courses in your library</p>
            <p className="text-sm text-zinc-500 mt-1.5">Browse the catalog and enroll to get started.</p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 mt-6 bg-zinc-950 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-zinc-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2"
            >
              Browse courses <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* No search/filter results */}
        {items && items.length > 0 && visible.length === 0 && (
          <div className="text-center py-24">
            <p className="text-zinc-500 text-sm">
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
      />
    </div>
  )
}

// ── Filter tab ────────────────────────────────────────────────────────────────

function Tab({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40
        ${active ? 'bg-zinc-950 text-white' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
    >
      {label}
      <span className="text-[11px] tabular-nums text-current opacity-60">{count}</span>
    </button>
  )
}

// ── Course card ──────────────────────────────────────────────────────────────

function CourseCard({ course, percent, completed, total }) {
  const isComplete = percent === 100
  const isStarted  = percent > 0

  return (
    <Link
      to={`/dashboard/${course.id}`}
      className="group bg-white rounded-2xl border border-zinc-200 overflow-hidden hover:border-zinc-300 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.14)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col"
    >
      {/* Cover */}
      <div className="aspect-[16/9] bg-zinc-100 overflow-hidden relative">
        {course.coverImage ? (
          <img
            src={course.coverImage}
            alt={course.title}
            className="h-full w-full object-cover group-hover:scale-[1.04] transition duration-700 ease-out"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <BookOpen className="h-9 w-9 text-zinc-300" />
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
        <h3 className=" font-semibold text-zinc-950 text-[16px] leading-snug line-clamp-2">
          {course.title}
        </h3>
        {course.subtitle && (
          <p className="text-[13px] text-zinc-500 mt-1 line-clamp-1">{course.subtitle}</p>
        )}

        <div className="mt-auto pt-4">
          {/* Stats row */}
          <div className="flex items-center gap-4 mb-3 text-xs text-zinc-400">
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
              <span className="text-xs text-zinc-400 font-medium">
                {isComplete ? 'Completed' : isStarted ? 'In progress' : 'Not started'}
              </span>
              <span className={`text-xs font-semibold font-mono tabular-nums
                ${isComplete ? 'text-emerald-600' : isStarted ? 'text-indigo-600' : 'text-zinc-400'}`}>
                {percent}%
              </span>
            </div>
            <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700
                  ${isComplete ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* CTA row */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-100">
          <span className="text-xs font-semibold text-zinc-400 group-hover:text-zinc-900 transition">
            {isComplete ? 'Review course' : isStarted ? 'Continue' : 'Start learning'}
          </span>
          <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition" />
        </div>
      </div>
    </Link>
  )
}

// ── Account panel ────────────────────────────────────────────────────────────

function AccountPanel({ open, onClose, user, profile, onLogout, navigate, toast }) {
  const [view,       setView]       = useState('menu')
  const [name,       setName]       = useState('')
  const [phone,      setPhone]      = useState('')
  const [busy,       setBusy]       = useState(false)
  const [error,      setError]      = useState('')
  const [deleteStep, setDeleteStep] = useState(1)

  useEffect(() => {
    if (open) {
      setView('menu')
      setName(profile?.name || '')
      setPhone('')
      setError('')
      setBusy(false)
      setDeleteStep(1)
    }
  }, [open, profile])

  async function handleSaveName(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Name cannot be empty.')
    setBusy(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), { name: name.trim() })
      await updateProfile(auth.currentUser, { displayName: name.trim() })
      toast('Name updated successfully.', 'success')
      onClose()
    } catch {
      setError('Could not update name. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(e) {
    e.preventDefault()
    setError('')
    if (!phone.trim()) return setError('Enter your phone number to confirm.')
    setBusy(true)
    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        phone.replace(/\D/g, '')
      )
      await reauthenticateWithCredential(auth.currentUser, credential)
      await deleteDoc(doc(db, 'users', user.uid))
      await deleteUser(auth.currentUser)
      toast('Your account has been deleted.', 'info')
      navigate('/', { replace: true })
    } catch (err) {
      if (
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setError('Incorrect phone number. Your account was not deleted.')
      } else {
        setError('Could not delete account. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const heading = view === 'menu' ? 'Account'
    : view === 'name'             ? 'Change name'
    :                               'Delete account'

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-zinc-950/30 z-40 backdrop-blur-[2px]"
      />

      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[340px] bg-white shadow-2xl flex flex-col">

        {/* Panel header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            {view !== 'menu' && (
              <button
                onClick={() => { setView('menu'); setError('') }}
                className="text-zinc-400 hover:text-zinc-600 transition mr-1"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>
            )}
            <h2 className="font-semibold text-zinc-950 text-base">{heading}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── MENU ── */}
        {view === 'menu' && (
          <div className="flex-1 overflow-y-auto">
            {/* Profile summary */}
            <div className="px-6 py-5 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                  {(profile?.name || user?.email || '?')
                    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900 text-sm truncate">
                    {profile?.name || '—'}
                  </p>
                  <p className="text-xs text-zinc-400 truncate">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Menu items */}
            <nav className="px-3 py-3 space-y-0.5">
              <PanelItem
                icon={<Pencil className="h-4 w-4" />}
                label="Change name"
                onClick={() => { setView('name'); setError('') }}
              />
              <PanelItem
                icon={<User className="h-4 w-4" />}
                label="Account email"
                sublabel={user?.email}
              />
              <div className="pt-2 mt-2 border-t border-zinc-100">
                <PanelItem
                  icon={<LogOut className="h-4 w-4" />}
                  label="Sign out"
                  onClick={onLogout}
                />
                <PanelItem
                  icon={<Trash2 className="h-4 w-4" />}
                  label="Delete account"
                  destructive
                  onClick={() => { setView('delete'); setError(''); setDeleteStep(1) }}
                />
              </div>
            </nav>
          </div>
        )}

        {/* ── CHANGE NAME ── */}
        {view === 'name' && (
          <form onSubmit={handleSaveName} className="flex-1 flex flex-col px-6 py-6">
            <label className="block">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                Full name
              </span>
              <input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                className="mt-2 w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition"
              />
            </label>
            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
            <div className="flex gap-3 mt-auto pt-6">
              <button
                type="button"
                onClick={() => setView('menu')}
                className="flex-1 border border-zinc-200 rounded-xl py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 bg-zinc-950 text-white rounded-xl py-3 text-sm font-semibold hover:bg-zinc-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Save'}
              </button>
            </div>
          </form>
        )}

        {/* ── DELETE ACCOUNT ── */}
        {view === 'delete' && (
          <div className="flex-1 flex flex-col px-6 py-6 overflow-y-auto">
            {deleteStep === 1 && (
              <>
                <div className="bg-red-50 border border-red-100 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-red-700">
                    <Trash2 className="h-4 w-4 shrink-0" />
                    <p className="font-semibold text-sm">This is permanent</p>
                  </div>
                  <ul className="text-xs text-red-600 space-y-1.5 list-disc list-inside leading-relaxed">
                    <li>Your account will be permanently deleted</li>
                    <li>All course access will be removed immediately</li>
                    <li>Your progress cannot be recovered</li>
                    <li>This action cannot be undone</li>
                  </ul>
                </div>
                <div className="flex gap-3 mt-auto pt-6">
                  <button
                    onClick={() => setView('menu')}
                    className="flex-1 border border-zinc-200 rounded-xl py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition"
                  >
                    Keep account
                  </button>
                  <button
                    onClick={() => setDeleteStep(2)}
                    className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-red-700 transition"
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {deleteStep === 2 && (
              <form onSubmit={handleDelete} className="flex flex-col flex-1">
                <p className="text-sm text-zinc-600 leading-relaxed mb-5">
                  Enter your <strong>phone number</strong> to confirm deletion.
                  This is the phone number you use to sign in.
                </p>
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                    Phone number
                  </span>
                  <input
                    required
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="08012345678"
                    className="mt-2 w-full border border-red-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-50 transition"
                  />
                </label>
                {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
                <div className="flex gap-3 mt-auto pt-6">
                  <button
                    type="button"
                    onClick={() => setDeleteStep(1)}
                    className="flex-1 border border-zinc-200 rounded-xl py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {busy
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</>
                      : 'Delete account'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function PanelItem({ icon, label, sublabel, onClick, destructive = false }) {
  const base = `w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-left transition
    ${destructive ? 'text-red-600 hover:bg-red-50' : 'text-zinc-700 hover:bg-zinc-50'}
    ${!onClick ? 'cursor-default' : 'cursor-pointer'}`

  return (
    <button onClick={onClick} className={base} disabled={!onClick}>
      <span className={`shrink-0 ${destructive ? 'text-red-400' : 'text-zinc-400'}`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <span className="font-medium">{label}</span>
        {sublabel && (
          <p className="text-xs text-zinc-400 truncate mt-0.5">{sublabel}</p>
        )}
      </div>
      {onClick && (
        <ChevronRight className={`h-4 w-4 shrink-0 ${destructive ? 'text-red-300' : 'text-zinc-300'}`} />
      )}
    </button>
  )
}