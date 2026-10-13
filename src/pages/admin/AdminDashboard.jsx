import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus, Eye, CheckCircle2, Circle, Trash2, Pencil, Loader2, AlertTriangle, X, LogOut, Check,
  Menu, Sun, Moon, Monitor, LayoutDashboard, BookOpen, Users, UserPlus, Search, ChevronRight,
  ArrowRightLeft, RotateCcw, UserX, GraduationCap, TrendingUp, Clock, Award, Shield,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import {
  listCourses, createCourse, deleteCourse, updateCourse, flattenLessons,
  listUsers, listAllEnrollments, listAllProgress, listPendingEnrollments,
  grantEnrollment, revokeEnrollment, reassignEnrollment, resetProgress, removeUser,
  cancelPendingEnrollment, setUserRole,
} from '../../lib/data'
import { grantAccessOnly } from '../../lib/access'

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'courses', label: 'Courses', icon: BookOpen },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'grant', label: 'Grant access', icon: UserPlus },
]

const toMs = (ts) => (ts?.toMillis ? ts.toMillis() : ts?.seconds ? ts.seconds * 1000 : 0)
const fmtDate = (ts) => { const ms = toMs(ts); return ms ? new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—' }

export default function AdminDashboard() {
  const { logout, user: me } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState(() => new URLSearchParams(location.search).get('tab') || 'overview')
  const [data, setData] = useState(null)       // { courses, users, enrollments, progress, pending }
  const [loadErr, setLoadErr] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  const showToast = useCallback((type, msg) => {
    clearTimeout(toastTimer.current)
    setToast({ type, msg })
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const [courses, users, enrollments, progress, pending] = await Promise.all([
        listCourses({ onlyPublished: false }), listUsers(), listAllEnrollments(), listAllProgress(),
        listPendingEnrollments().catch(() => []),
      ])
      setData({ courses, users, enrollments, progress, pending })
      setLoadErr('')
    } catch (err) {
      console.error(err)
      setLoadErr(err.code === 'permission-denied'
        ? 'Permission denied. Update your Firestore security rules so admins can read users, enrollments and progress (see firestore.rules).'
        : 'Could not load admin data. Check your connection and try again.')
    }
  }, [])

  useEffect(() => { refresh(); return () => clearTimeout(toastTimer.current) }, [refresh])
  useEffect(() => {
    const url = new URL(window.location.href); url.searchParams.set('tab', tab)
    window.history.replaceState(null, '', url)
  }, [tab])
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  // Derived, indexed data — computed once per load.
  const model = useMemo(() => {
    if (!data) return null
    const courseById = new Map(data.courses.map(c => [c.id, { ...c, lessonIds: new Set(flattenLessons(c).map(l => l.id)) }]))
    const progressByKey = new Map(data.progress.map(p => [`${p.uid}_${p.courseId}`, p]))
    const pct = (uid, courseId) => {
      const c = courseById.get(courseId)
      const total = c?.lessonIds.size || 0
      const done = (progressByKey.get(`${uid}_${courseId}`)?.completedLessonIds || []).filter(id => c?.lessonIds.has(id)).length
      return { total, done, percent: total ? Math.round((done / total) * 100) : 0, updatedAt: progressByKey.get(`${uid}_${courseId}`)?.updatedAt }
    }
    const enrollByUser = new Map()
    const enrollByCourse = new Map()
    for (const e of data.enrollments) {
      if (!enrollByUser.has(e.uid)) enrollByUser.set(e.uid, [])
      enrollByUser.get(e.uid).push(e)
      enrollByCourse.set(e.courseId, (enrollByCourse.get(e.courseId) || 0) + 1)
    }
    const students = data.users.map(u => {
      const enr = (enrollByUser.get(u.uid) || []).filter(e => courseById.has(e.courseId))
      const courses = enr.map(e => ({ ...e, course: courseById.get(e.courseId), ...pct(u.uid, e.courseId) }))
      const avg = courses.length ? Math.round(courses.reduce((s, c) => s + c.percent, 0) / courses.length) : 0
      return { ...u, courses, avg, completedCount: courses.filter(c => c.percent === 100).length }
    }).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
    const completions = students.reduce((s, u) => s + u.completedCount, 0)
    const allPct = students.flatMap(s => s.courses.map(c => c.percent))
    return {
      courseById, enrollByCourse, students, completions,
      avgProgress: allPct.length ? Math.round(allPct.reduce((a, b) => a + b, 0) / allPct.length) : 0,
      courseCompletion: (courseId) => {
        const list = students.flatMap(s => s.courses.filter(c => c.courseId === courseId))
        return list.length ? Math.round((list.filter(c => c.percent === 100).length / list.length) * 100) : 0
      },
    }
  }, [data])

  function go(id) { setTab(id); setMenuOpen(false); window.scrollTo({ top: 0 }) }

  const nav = (
    <nav className="flex flex-col gap-1">
      {TABS.map(t => (
        <button
          key={t.id}
          onClick={() => go(t.id)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition
            ${tab === t.id
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white'}`}
        >
          <t.icon className="h-4 w-4" /> {t.label}
          {t.id === 'students' && model && <span className="ml-auto text-xs opacity-70 tabular-nums">{model.students.length}</span>}
        </button>
      ))}
    </nav>
  )

  const footer = (
    <div className="space-y-3">
      <ThemeSwitch />
      <Link to="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">
        <Eye className="h-4 w-4" /> View site
      </Link>
      <button onClick={logout} className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col justify-between border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <div>
          <Link to="/admin" className="flex items-center gap-2 px-3 h-12 mb-4 text-lg font-semibold tracking-tight">
            CoursePress <span className="text-amber-500">·</span> <span className="text-neutral-500 dark:text-neutral-400 font-medium">Admin</span>
          </Link>
          {nav}
        </div>
        {footer}
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-40 h-14 flex items-center justify-between px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 backdrop-blur">
        <Link to="/admin" className="font-semibold tracking-tight">CoursePress <span className="text-amber-500">·</span> Admin</Link>
        <button onClick={() => setMenuOpen(true)} className="icon-btn" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
      </header>
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 sidebar-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 max-w-[85%] bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 p-4 flex flex-col justify-between sidebar-in">
            <div>
              <div className="flex items-center justify-between h-10 mb-4">
                <span className="font-semibold">Menu</span>
                <button onClick={() => setMenuOpen(false)} className="icon-btn" aria-label="Close menu"><X className="h-4 w-4" /></button>
              </div>
              {nav}
            </div>
            {footer}
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-10">
          {loadErr && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-500/10 p-4 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <span className="flex-1">{loadErr}</span>
              <button onClick={refresh} className="btn-ghost">Retry</button>
            </div>
          )}

          {tab === 'overview' && <Overview model={model} data={data} go={go} />}
          {tab === 'courses' && <CoursesPanel data={data} model={model} refresh={refresh} showToast={showToast} navigate={navigate} />}
          {tab === 'students' && <StudentsPanel data={data} model={model} refresh={refresh} showToast={showToast} meUid={me?.uid} />}
          {tab === 'grant' && <ManualAccessPanel courses={data?.courses} showToast={showToast} onDone={refresh} />}
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[80] toast-in">
          <div className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-lg border
            ${toast.type === 'ok' ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white' : 'bg-white dark:bg-neutral-900 border-red-300 dark:border-red-500/40'}`}>
            {toast.type === 'ok' ? <Check className="h-4 w-4 text-amber-400 dark:text-amber-600 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
            <span>{toast.msg}</span>
            <button onClick={() => setToast(null)} className="ml-1 opacity-60 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Theme switch: System / Light / Dark ─────────────────────────────────────
function ThemeSwitch() {
  const { mode, setMode } = useTheme()
  const opts = [{ id: 'system', icon: Monitor, label: 'System' }, { id: 'light', icon: Sun, label: 'Light' }, { id: 'dark', icon: Moon, label: 'Dark' }]
  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 p-1" role="radiogroup" aria-label="Theme">
      {opts.map(o => (
        <button key={o.id} role="radio" aria-checked={mode === o.id} onClick={() => setMode(o.id)} title={o.label}
          className={`flex items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium transition
            ${mode === o.id ? 'bg-white dark:bg-neutral-950 shadow-sm text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'}`}>
          <o.icon className="h-3.5 w-3.5" /> <span className="hidden xl:inline">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

function PageTitle({ title, subtitle, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function ProgressBar({ percent }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${percent === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${percent}%` }} />
    </div>
  )
}

function Avatar({ name, email }) {
  const initials = (name || email || '?').split(/[\s@]/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()
  return <span className="h-9 w-9 shrink-0 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center text-xs font-bold">{initials}</span>
}

function Skeleton({ rows = 3 }) {
  return <div className="card divide-y divide-neutral-100 dark:divide-neutral-800">{Array.from({ length: rows }).map((_, i) => (
    <div key={i} className="flex items-center gap-4 px-5 py-4"><div className="skeleton h-9 w-9 rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-3.5 w-1/3 rounded" /><div className="skeleton h-3 w-1/5 rounded" /></div></div>
  ))}</div>
}

// ── Overview ────────────────────────────────────────────────────────────────
function Overview({ model, data, go }) {
  if (!model) return <><PageTitle title="Overview" subtitle="Loading…" /><Skeleton rows={4} /></>
  const published = data.courses.filter(c => c.published).length
  const stats = [
    { label: 'Students', value: model.students.length, icon: Users },
    { label: 'Courses', value: data.courses.length, hint: `${published} live · ${data.courses.length - published} draft`, icon: BookOpen },
    { label: 'Enrollments', value: data.enrollments.length, hint: data.pending.length ? `${data.pending.length} pending` : null, icon: GraduationCap },
    { label: 'Completions', value: model.completions, hint: `${model.avgProgress}% avg progress`, icon: Award },
  ]
  const recent = [...data.enrollments].sort((a, b) => toMs(b.grantedAt) - toMs(a.grantedAt)).slice(0, 6)
  const userBy = new Map(model.students.map(s => [s.uid, s]))
  return (
    <>
      <PageTitle title="Overview" subtitle="Everything happening on your site at a glance." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="card p-5">
            <div className="flex items-center justify-between text-muted text-xs font-medium uppercase tracking-wide">{s.label}<s.icon className="h-4 w-4" /></div>
            <p className="mt-3 text-3xl font-semibold tabular-nums">{s.value}</p>
            {s.hint && <p className="text-xs text-muted mt-1">{s.hint}</p>}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-4 mt-6">
        <div className="card lg:col-span-3">
          <div className="flex items-center justify-between px-5 py-4 border-b border-soft">
            <h2 className="font-semibold flex items-center gap-2"><Clock className="h-4 w-4 text-muted" /> Recent enrollments</h2>
            <button onClick={() => go('students')} className="btn-ghost">All students <ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {recent.length === 0 && <li className="px-5 py-8 text-sm text-muted text-center">No enrollments yet.</li>}
            {recent.map(e => {
              const u = userBy.get(e.uid)
              return (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={u?.name} email={e.email} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{u?.name || e.email}</p>
                    <p className="text-xs text-muted truncate">{model.courseById.get(e.courseId)?.title || 'Deleted course'}</p>
                  </div>
                  <span className="text-xs text-muted shrink-0">{fmtDate(e.grantedAt)}</span>
                </li>
              )
            })}
          </ul>
        </div>
        <div className="card lg:col-span-2">
          <div className="px-5 py-4 border-b border-soft"><h2 className="font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-muted" /> Course completion</h2></div>
          <ul className="p-5 space-y-4">
            {data.courses.length === 0 && <li className="text-sm text-muted text-center py-4">No courses yet.</li>}
            {data.courses.slice(0, 6).map(c => {
              const rate = model.courseCompletion(c.id)
              return (
                <li key={c.id}>
                  <div className="flex justify-between text-sm mb-1.5"><span className="truncate pr-3">{c.title}</span><span className="text-muted tabular-nums">{model.enrollByCourse.get(c.id) || 0} · {rate}%</span></div>
                  <ProgressBar percent={rate} />
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </>
  )
}

// ── Courses ─────────────────────────────────────────────────────────────────
function CoursesPanel({ data, model, refresh, showToast, navigate }) {
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null)
  const setRow = (id, v) => setBusy(b => { const n = { ...b }; if (v) n[id] = v; else delete n[id]; return n })

  async function handleCreate() {
    setCreating(true)
    try { navigate(`/admin/courses/${await createCourse({ title: 'New course' })}`) }
    catch (err) { console.error(err); showToast('error', 'Could not create the course. Please try again.'); setCreating(false) }
  }
  async function togglePublish(c) {
    setRow(c.id, 'publish')
    try { await updateCourse(c.id, { published: !c.published }); await refresh(); showToast('ok', c.published ? `"${c.title}" moved to drafts.` : `"${c.title}" is now live.`) }
    catch (err) { console.error(err); showToast('error', 'Could not change the course status.') }
    finally { setRow(c.id) }
  }
  async function confirmDelete() {
    const c = deleteTarget; setRow(c.id, 'delete')
    try { await deleteCourse(c.id); setDeleteTarget(null); await refresh(); showToast('ok', `"${c.title}" deleted.`) }
    catch (err) { console.error(err); showToast('error', 'Could not delete the course.') }
    finally { setRow(c.id) }
  }

  return (
    <>
      <PageTitle
        title="Courses"
        subtitle={data ? `${data.courses.length} total` : 'Loading your courses…'}
        action={<button onClick={handleCreate} disabled={creating} className="btn-primary">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} New course</button>}
      />
      {!data ? <Skeleton /> : data.courses.length === 0 ? (
        <div className="card p-12 text-center"><BookOpen className="h-8 w-8 mx-auto text-muted" /><p className="mt-3 font-medium">No courses yet</p><p className="text-sm text-muted">Create your first course to get started.</p></div>
      ) : (
        <div className="card divide-y divide-neutral-100 dark:divide-neutral-800 overflow-hidden">
          {data.courses.map((c, i) => {
            const rowBusy = busy[c.id]
            const lessons = model.courseById.get(c.id)?.lessonIds.size || 0
            return (
              <div key={c.id} className="row-in flex flex-col md:flex-row md:items-center gap-4 px-5 py-4" style={{ animationDelay: `${i * 30}ms` }}>
                <div className="h-14 w-24 shrink-0 rounded-lg bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                  {c.coverImage ? <img src={c.coverImage} alt="" className="h-full w-full object-cover" loading="lazy" /> : <BookOpen className="h-5 w-5 m-auto mt-4 text-muted" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{c.title}</p>
                    <span className={`chip ${c.published ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'}`}>{c.published ? 'Live' : 'Draft'}</span>
                    {c.certificate?.enabled && c.certificate?.imageUrl && <span className="chip bg-amber-500/15 text-amber-700 dark:text-amber-400"><Award className="h-3 w-3" /> Certificate</span>}
                  </div>
                  <p className="text-xs text-muted mt-1">₦{Number(c.price || 0).toLocaleString()} · {lessons} lessons · {model.enrollByCourse.get(c.id) || 0} students · {model.courseCompletion(c.id)}% completed</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => togglePublish(c)} disabled={!!rowBusy} className="btn-ghost">
                    {rowBusy === 'publish' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : c.published ? <Circle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {c.published ? 'Unpublish' : 'Publish'}
                  </button>
                  <Link to={`/admin/courses/${c.id}`} className="btn-ghost"><Pencil className="h-3.5 w-3.5" /> Edit</Link>
                  <button onClick={() => setDeleteTarget(c)} disabled={!!rowBusy} className="btn-danger" aria-label={`Delete ${c.title}`}>
                    {rowBusy === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {deleteTarget && (
        <Confirm
          title="Delete course?"
          body={<>This permanently removes <strong>"{deleteTarget.title}"</strong> and its curriculum. This can't be undone.</>}
          confirmLabel="Delete" busy={busy[deleteTarget.id] === 'delete'}
          onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete}
        />
      )}
    </>
  )
}

// ── Students ────────────────────────────────────────────────────────────────
function StudentsPanel({ data, model, refresh, showToast, meUid }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [openUid, setOpenUid] = useState(null)

  const list = useMemo(() => {
    if (!model) return []
    const s = q.trim().toLowerCase()
    return model.students.filter(u => {
      if (filter === 'admins' && u.role !== 'admin') return false
      if (filter === 'enrolled' && !u.courses.length) return false
      if (filter === 'completed' && !u.completedCount) return false
      if (filter === 'none' && u.courses.length) return false
      return !s || (u.name || '').toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s)
    })
  }, [model, q, filter])

  const open = model?.students.find(u => u.uid === openUid)

  return (
    <>
      <PageTitle title="Students" subtitle={model ? `${model.students.length} registered · ${data.pending.length} pending invite${data.pending.length === 1 ? '' : 's'}` : 'Loading…'} />
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or email" className="admin-input pl-9" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="admin-input sm:w-48">
          <option value="all">All users</option><option value="enrolled">Enrolled</option><option value="completed">Completed a course</option>
          <option value="none">No courses</option><option value="admins">Admins</option>
        </select>
      </div>

      {!model ? <Skeleton rows={5} /> : (
        <div className="card overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted border-b border-soft">
            <span className="col-span-5">Student</span><span className="col-span-2">Courses</span><span className="col-span-3">Avg. progress</span><span className="col-span-2 text-right">Joined</span>
          </div>
          {list.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted">No students match your search.</p>}
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {list.map(u => (
              <li key={u.uid}>
                <button onClick={() => setOpenUid(u.uid)} className="w-full text-left grid grid-cols-12 gap-4 items-center px-5 py-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition">
                  <span className="col-span-12 md:col-span-5 flex items-center gap-3 min-w-0">
                    <Avatar name={u.name} email={u.email} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2"><span className="font-medium truncate">{u.name || 'Unnamed'}</span>{u.role === 'admin' && <span className="chip bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">Admin</span>}</span>
                      <span className="block text-xs text-muted truncate">{u.email}</span>
                    </span>
                  </span>
                  <span className="col-span-4 md:col-span-2 text-sm tabular-nums">{u.courses.length}{u.completedCount ? <span className="text-emerald-600 dark:text-emerald-400 text-xs"> · {u.completedCount} done</span> : null}</span>
                  <span className="col-span-5 md:col-span-3 flex items-center gap-2"><ProgressBar percent={u.avg} /><span className="text-xs tabular-nums text-muted w-9 text-right">{u.avg}%</span></span>
                  <span className="col-span-3 md:col-span-2 text-xs text-muted text-right">{fmtDate(u.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data?.pending?.length > 0 && <PendingList pending={data.pending} courseById={model?.courseById} refresh={refresh} showToast={showToast} />}

      {open && <StudentDrawer student={open} courses={data.courses} onClose={() => setOpenUid(null)} refresh={refresh} showToast={showToast} isSelf={open.uid === meUid} />}
    </>
  )
}

function PendingList({ pending, courseById, refresh, showToast }) {
  const [busy, setBusy] = useState('')
  async function cancel(p) {
    setBusy(p.id)
    try { await cancelPendingEnrollment(p.id); await refresh(); showToast('ok', `Invite for ${p.email} cancelled.`) }
    catch { showToast('error', 'Could not cancel the invite.') } finally { setBusy('') }
  }
  return (
    <div className="mt-8">
      <h2 className="font-semibold mb-1">Pending invites</h2>
      <p className="text-sm text-muted mb-3">Granted access but not signed in yet — activated automatically on first login.</p>
      <ul className="card divide-y divide-neutral-100 dark:divide-neutral-800">
        {pending.map(p => (
          <li key={p.id} className="flex items-center gap-3 px-5 py-3">
            <Avatar name={p.name} email={p.email} />
            <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{p.name || p.email}</p><p className="text-xs text-muted truncate">{p.email} · {courseById?.get(p.courseId)?.title || 'Deleted course'}</p></div>
            <button onClick={() => cancel(p)} disabled={busy === p.id} className="btn-danger">{busy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Cancel</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StudentDrawer({ student, courses, onClose, refresh, showToast, isSelf }) {
  const [busy, setBusy] = useState('')
  const [assignId, setAssignId] = useState('')
  const [moving, setMoving] = useState(null)     // courseId being reassigned
  const [moveTo, setMoveTo] = useState('')
  const [confirm, setConfirm] = useState(null)   // { kind, courseId? }

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && !confirm && onClose()
    window.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose, confirm])

  const enrolledIds = new Set(student.courses.map(c => c.courseId))
  const available = courses.filter(c => !enrolledIds.has(c.id))
  const title = (id) => courses.find(c => c.id === id)?.title || 'course'

  async function run(key, fn, okMsg) {
    setBusy(key)
    try { await fn(); await refresh(); showToast('ok', okMsg) }
    catch (err) { console.error(err); showToast('error', err.code === 'permission-denied' ? 'Permission denied by Firestore rules.' : 'That action failed. Please try again.') }
    finally { setBusy(''); setConfirm(null) }
  }

  const assign = () => run('assign', () => grantEnrollment({ uid: student.uid, courseId: assignId, email: student.email, source: 'admin' }), `Assigned "${title(assignId)}".`).then(() => setAssignId(''))
  const reassign = (from) => run(`move-${from}`, () => reassignEnrollment({ uid: student.uid, email: student.email, fromCourseId: from, toCourseId: moveTo }), `Moved to "${title(moveTo)}".`).then(() => { setMoving(null); setMoveTo('') })

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/50 sidebar-backdrop" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col sidebar-in">
        <div className="flex items-start gap-3 p-5 border-b border-soft">
          <Avatar name={student.name} email={student.email} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{student.name || 'Unnamed'}</p>
            <p className="text-sm text-muted truncate">{student.email}</p>
            <p className="text-xs text-muted mt-1">Joined {fmtDate(student.createdAt)} · {student.role}</p>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {[['Courses', student.courses.length], ['Completed', student.completedCount], ['Avg.', `${student.avg}%`]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-neutral-50 dark:bg-neutral-800/60 p-3 text-center"><p className="text-lg font-semibold tabular-nums">{v}</p><p className="text-[11px] text-muted uppercase tracking-wide">{l}</p></div>
            ))}
          </div>

          <section>
            <h3 className="text-sm font-semibold mb-3">Assigned courses</h3>
            {student.courses.length === 0 && <p className="text-sm text-muted">Not assigned to any course yet.</p>}
            <ul className="space-y-3">
              {student.courses.map(c => (
                <li key={c.courseId} className="rounded-xl border border-soft p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.course.title}</p>
                      <p className="text-xs text-muted mt-0.5">{c.done}/{c.total} lessons · since {fmtDate(c.grantedAt)}{c.updatedAt ? ` · active ${fmtDate(c.updatedAt)}` : ''}</p>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums ${c.percent === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>{c.percent}%</span>
                  </div>
                  <div className="mt-2.5"><ProgressBar percent={c.percent} /></div>

                  {moving === c.courseId ? (
                    <div className="mt-3 flex gap-2">
                      <select value={moveTo} onChange={e => setMoveTo(e.target.value)} className="admin-input">
                        <option value="">Move to…</option>
                        {available.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                      </select>
                      <button onClick={() => reassign(c.courseId)} disabled={!moveTo || !!busy} className="btn-primary shrink-0">{busy === `move-${c.courseId}` ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Move'}</button>
                      <button onClick={() => setMoving(null)} className="icon-btn shrink-0" aria-label="Cancel"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-1">
                      <button onClick={() => { setMoving(c.courseId); setMoveTo('') }} disabled={!available.length} className="btn-ghost"><ArrowRightLeft className="h-3.5 w-3.5" /> Reassign</button>
                      <button onClick={() => setConfirm({ kind: 'reset', courseId: c.courseId })} disabled={!c.done} className="btn-ghost"><RotateCcw className="h-3.5 w-3.5" /> Reset progress</button>
                      <button onClick={() => setConfirm({ kind: 'unassign', courseId: c.courseId })} className="btn-danger ml-auto"><X className="h-3.5 w-3.5" /> Unassign</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-3">Assign a course</h3>
            {available.length === 0 ? <p className="text-sm text-muted">Already assigned to every course.</p> : (
              <div className="flex gap-2">
                <select value={assignId} onChange={e => setAssignId(e.target.value)} className="admin-input">
                  <option value="">Choose a course…</option>
                  {available.map(a => <option key={a.id} value={a.id}>{a.title}{a.published ? '' : ' (draft)'}</option>)}
                </select>
                <button onClick={assign} disabled={!assignId || !!busy} className="btn-primary shrink-0">{busy === 'assign' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Assign</button>
              </div>
            )}
          </section>
        </div>

        <div className="p-5 border-t border-soft space-y-3">
          <button
            onClick={() => run('role', () => setUserRole(student.uid, student.role === 'admin' ? 'student' : 'admin'),
              student.role === 'admin'
                ? `${student.name || student.email} is now a student. They keep admin tools only if another admin remains.`
                : `${student.name || student.email} is now an admin.`)}
            disabled={isSelf || !!busy}
            className="btn-secondary w-full justify-center py-2.5"
          >
            {busy === 'role' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            {student.role === 'admin' ? 'Make student' : 'Make admin'}
          </button>
          {isSelf
            ? <p className="text-xs text-muted text-center">You can't change your own role.</p>
            : <p className="text-xs text-muted text-center">Admins keep full student access — enrolling, lessons and certificates all still work.</p>}
          <button onClick={() => setConfirm({ kind: 'remove' })} disabled={isSelf || student.role === 'admin'} className="btn-danger w-full justify-center py-2.5 border border-red-200 dark:border-red-500/30">
            <UserX className="h-4 w-4" /> Remove user from site
          </button>
          {(isSelf || student.role === 'admin') && <p className="text-xs text-muted text-center">Admin accounts can't be removed here.</p>}
        </div>
      </aside>

      {confirm?.kind === 'unassign' && <Confirm title="Unassign course?" body={<>{student.name || student.email} will lose access to <strong>{title(confirm.courseId)}</strong>. Their progress is kept if you assign it again.</>} confirmLabel="Unassign" busy={!!busy}
        onCancel={() => setConfirm(null)} onConfirm={() => run('unassign', () => revokeEnrollment(student.uid, confirm.courseId), `Unassigned "${title(confirm.courseId)}".`)} />}
      {confirm?.kind === 'reset' && <Confirm title="Reset progress?" body={<>All completed lessons in <strong>{title(confirm.courseId)}</strong> will be cleared for this student.</>} confirmLabel="Reset" busy={!!busy}
        onCancel={() => setConfirm(null)} onConfirm={() => run('reset', () => resetProgress(student.uid, confirm.courseId), 'Progress reset.')} />}
      {confirm?.kind === 'remove' && <Confirm title="Remove this user?" body={<>This removes <strong>{student.name || student.email}</strong> from the site: all course access, progress and pending invites are deleted and they are signed out immediately.</>} confirmLabel="Remove user" busy={!!busy}
        onCancel={() => setConfirm(null)} onConfirm={() => run('remove', () => removeUser(student), `${student.name || student.email} removed.`).then(onClose)} />}
    </div>
  )
}

function Confirm({ title, body, confirmLabel, busy, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/50 modal-backdrop" onClick={() => !busy && onCancel()} />
      <div className="relative card max-w-sm w-full p-6 modal-in">
        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-4"><AlertTriangle className="h-5 w-5 text-red-500" /></div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted mt-1.5 leading-relaxed">{body}</p>
        <div className="flex gap-2 mt-6">
          <button onClick={onCancel} disabled={busy} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={onConfirm} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-70">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Grant manual access ─────────────────────────────────────────────────────
function ManualAccessPanel({ courses, showToast, onDone }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', courseId: '' })
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const field = (key) => ({ value: form[key], onChange: e => setForm(f => ({ ...f, [key]: e.target.value })) })

  async function handleGrant(e) {
    e.preventDefault()
    setBusy(true); setStatus(null)
    try {
      await grantAccessOnly({ name: form.name, email: form.email.trim().toLowerCase(), phone: form.phone, courseId: form.courseId })
      setStatus({ ok: true, msg: `Access granted. Tell ${form.email} to visit ${window.location.origin}/login — they sign in with their email and phone number. First-time users get an account automatically.` })
      showToast('ok', `Access granted for ${form.email}.`)
      setForm(f => ({ ...f, name: '', email: '', phone: '' }))
      onDone?.()
    } catch (err) {
      console.error(err)
      const msg = err.code === 'permission-denied' ? 'Permission denied by Firestore rules.' : (err.message || 'Something went wrong. Try again.')
      setStatus({ ok: false, msg }); showToast('error', msg)
    } finally { setBusy(false) }
  }

  return (
    <>
      <PageTitle title="Grant access" subtitle="For students who paid directly (bank transfer, cash, etc). No emails are sent from your end." />
      <form onSubmit={handleGrant} className="card p-6 max-w-xl space-y-4">
        {[['name', 'Student name', 'text', 'Full name'], ['email', 'Student email', 'email', 'their@email.com'], ['phone', 'Student phone number', 'tel', 'Their phone number']].map(([k, l, t, p]) => (
          <label key={k} className="block">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted mb-1.5">{l}</span>
            <input required type={t} placeholder={p} className="admin-input" {...field(k)} />
          </label>
        ))}
        <label className="block">
          <span className="block text-xs font-medium uppercase tracking-wide text-muted mb-1.5">Course</span>
          <select required className="admin-input" {...field('courseId')}>
            <option value="">Choose a course…</option>
            {courses?.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <button disabled={busy} className="btn-primary w-full justify-center">{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Granting access…</> : 'Grant access'}</button>
        {status && (
          <div className={`rounded-lg p-4 text-sm leading-relaxed flex items-start gap-2.5 row-in border ${status.ok ? 'bg-amber-500/10 border-amber-300/60' : 'bg-red-500/10 border-red-300/60'}`}>
            {status.ok ? <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
            <span>{status.msg}</span>
          </div>
        )}
      </form>
    </>
  )
}
