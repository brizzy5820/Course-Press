import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Eye, CheckCircle2, Circle, Trash2, Pencil,
  Loader2, AlertTriangle, X, ArrowRight, LogOut, Check, Menu,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { listCourses, createCourse, deleteCourse, updateCourse } from '../../lib/data'
import { grantAccessOnly } from '../../lib/access'

export default function AdminDashboard() {
  const { logout } = useAuth()
  const [courses, setCourses]   = useState(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy]         = useState({})      // { [courseId]: 'publish' | 'delete' }
  const [deleteTarget, setDeleteTarget] = useState(null) // course object | null
  const [toast, setToast]       = useState(null)     // { type: 'ok'|'error', msg }
  const [menuOpen, setMenuOpen] = useState(false)     // mobile sidebar
  const toastTimer = useRef(null)

  function showToast(type, msg) {
    clearTimeout(toastTimer.current)
    setToast({ type, msg })
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }

  function refresh() {
    listCourses({ onlyPublished: false }).then(setCourses)
  }
  useEffect(() => { refresh(); return () => clearTimeout(toastTimer.current) }, [])

  // lock body scroll while mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  async function handleCreate() {
    setMenuOpen(false)
    setCreating(true)
    try {
      const id = await createCourse({ title: 'New course' })
      window.location.href = `/admin/courses/${id}`
    } catch (err) {
      console.error(err)
      showToast('error', 'Could not create course. Try again.')
      setCreating(false)
    }
  }

  function handleLogout() {
    setMenuOpen(false)
    logout()
  }

  async function togglePublish(c) {
    setBusy(b => ({ ...b, [c.id]: 'publish' }))
    try {
      await updateCourse(c.id, { published: !c.published })
      refresh()
      showToast('ok', c.published ? `"${c.title}" moved to drafts.` : `"${c.title}" is now live.`)
    } catch (err) {
      console.error(err)
      showToast('error', 'Could not update course status.')
    } finally {
      setBusy(b => { const n = { ...b }; delete n[c.id]; return n })
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const c = deleteTarget
    setBusy(b => ({ ...b, [c.id]: 'delete' }))
    try {
      await deleteCourse(c.id)
      setDeleteTarget(null)
      refresh()
      showToast('ok', `"${c.title}" deleted.`)
    } catch (err) {
      console.error(err)
      showToast('error', 'Could not delete course.')
    } finally {
      setBusy(b => { const n = { ...b }; delete n[c.id]; return n })
    }
  }

  return (
    <div className="min-h-screen bg-white text-black">

      {/* ── Fixed header ── */}
      <header className="fixed top-0 inset-x-0 z-40 bg-white border-b border-black/10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/admin" className=" text-lg font-semibold tracking-tight text-black">
            CoursePress <span className="text-amber-500">·</span> Admin
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-5 text-sm">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-zinc-500 hover:text-black transition"
            >
              View site <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-1.5 text-zinc-500 hover:text-black transition disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add course
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-zinc-500 hover:text-black transition"
            >
              Sign out <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Mobile menu trigger */}
          <button
            onClick={() => setMenuOpen(true)}
            className="sm:hidden flex items-center justify-center h-9 w-9 rounded-lg text-zinc-600 hover:bg-zinc-100 active:scale-95 transition"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* spacer so fixed header doesn't overlap content */}
      <div className="h-16" />

      {/* ── Mobile sidebar ── */}
      {menuOpen && (
        <div className="sm:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 sidebar-backdrop"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute top-0 right-0 h-full w-72 max-w-[80%] bg-white border-l border-black/10 shadow-xl sidebar-in flex flex-col">
            <div className="h-16 px-5 flex items-center justify-between border-b border-black/10 shrink-0">
              <span className=" font-semibold text-black">Menu</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 active:scale-95 transition"
                aria-label="Close menu"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <nav className="flex flex-col p-3 gap-1">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-black hover:bg-amber-50 active:scale-[0.98] transition disabled:opacity-50"
              >
                {creating
                  ? <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                  : <Plus className="h-4 w-4 text-amber-600" />}
                {creating ? 'Creating…' : 'Add course'}
              </button>

              <Link
                to="/"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-black hover:bg-zinc-100 active:scale-[0.98] transition"
              >
                <Eye className="h-4 w-4 text-zinc-500" />
                View site
              </Link>

              <div className="h-px bg-black/10 my-2" />

              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-black hover:bg-zinc-100 active:scale-[0.98] transition"
              >
                <LogOut className="h-4 w-4 text-zinc-500" />
                Sign out
              </button>
            </nav>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-14">

        {/* ---- Courses ---- */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-sans font-semibold text-black">Courses</h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                {courses ? `${courses.length} total` : 'Loading your courses…'}
              </p>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-1.5 bg-black text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-amber-600 active:scale-[0.97] transition disabled:opacity-60 disabled:pointer-events-none"
            >
              {creating
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…</>
                : <><Plus className="h-3.5 w-3.5" /> New course</>}
            </button>
          </div>

          <div className="border border-black/10 rounded-xl overflow-hidden bg-white divide-y divide-black/5 shadow-sm">

            {/* Skeleton loading state */}
            {courses === null && (
              <div className="divide-y divide-black/5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="flex items-center justify-between px-5 py-4">
                    <div className="space-y-2">
                      <div className="h-3.5 w-40 rounded skeleton" />
                      <div className="h-3 w-24 rounded skeleton" />
                    </div>
                    <div className="h-3 w-20 rounded skeleton" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {courses?.length === 0 && (
              <div className="p-10 text-center">
                <p className="text-sm text-zinc-500">No courses yet.</p>
                <button
                  onClick={handleCreate}
                  className="mt-3 text-sm font-medium text-amber-600 hover:text-amber-700 hover:underline"
                >
                  Create your first course →
                </button>
              </div>
            )}

            {/* Course rows */}
            {courses?.map((c, i) => {
              const rowBusy = busy[c.id]
              return (
              <div
  key={c.id}
  className="flex flex-col md:flex-row md:items-center md:justify-between px-5 py-4 hover:bg-zinc-50 transition-colors row-in gap-3 md:gap-4"
  style={{ animationDelay: `${i * 40}ms` }}
>
  {/* Left Content */}
  <div className="min-w-0 flex-1">

    {/* Title */}
    <p className="font-medium text-black truncate whitespace-nowrap">
      {c.title}
    </p>

    {/* Mobile Actions */}
    <div className="flex md:hidden items-center gap-2 mt-3 flex-wrap">
      <button
        onClick={() => togglePublish(c)}
        disabled={!!rowBusy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-600 hover:text-black hover:bg-zinc-100 transition disabled:opacity-50 disabled:pointer-events-none"
      >
        {rowBusy === 'publish' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : c.published ? (
          <Circle className="h-3.5 w-3.5" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}

        {rowBusy === 'publish'
          ? 'Working…'
          : c.published
          ? 'Unpublish'
          : 'Publish'}
      </button>
      <Link
        to={`/admin/courses/${c.id}`}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-600 hover:text-black hover:bg-zinc-100 transition"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </Link>

      <button
        onClick={() => setDeleteTarget(c)}
        disabled={!!rowBusy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-400 hover:text-black hover:bg-zinc-100 transition disabled:opacity-50 disabled:pointer-events-none"
      >
        {rowBusy === 'delete' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </button>
    </div>

    {/* Status & Price */}
    <p className="text-xs text-zinc-500 mt-3 flex items-center gap-2 flex-wrap">
      {c.published ? (
        <span className="flex items-center gap-1 text-amber-600 font-medium">
          <CheckCircle2 className="h-3 w-3" />
          Published
        </span>
      ) : (
        <span className="flex items-center gap-1 text-zinc-400">
          <Circle className="h-3 w-3" />
          Draft
        </span>
      )}

      <span className="text-zinc-300">•</span>

      <span className="font-medium text-zinc-700">
        ₦{Number(c.price || 0).toLocaleString()}
      </span>
    </p>
  </div>

  {/* Desktop Actions */}
  <div className="hidden md:flex items-center gap-2 text-sm shrink-0">
    <button
      onClick={() => togglePublish(c)}
      disabled={!!rowBusy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-600 hover:text-black hover:bg-zinc-100 transition disabled:opacity-50 disabled:pointer-events-none"
    >
      {rowBusy === 'publish' ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : c.published ? (
        <Circle className="h-3.5 w-3.5" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5" />
      )}

      {rowBusy === 'publish'
        ? 'Working…'
        : c.published
        ? 'Unpublish'
        : 'Publish'}
    </button>

    <Link
      to={`/admin/courses/${c.id}`}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-600 hover:text-black hover:bg-zinc-100 transition"
    >
      <Pencil className="h-3.5 w-3.5" />
      Edit
    </Link>

    <button
      onClick={() => setDeleteTarget(c)}
      disabled={!!rowBusy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-400 hover:text-black hover:bg-zinc-100 transition disabled:opacity-50 disabled:pointer-events-none"
    >
      {rowBusy === 'delete' ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </button>
  </div>
</div>
              )
            })}
          </div>
        </section>

        {/* ---- Manual access grant ---- */}
        <ManualAccessPanel courses={courses} showToast={showToast} />
      </main>

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div
            className="absolute inset-0 bg-black/40 modal-backdrop"
            onClick={() => (busy[deleteTarget.id] ? null : setDeleteTarget(null))}
          />
          <div className="relative bg-white rounded-2xl border border-black/10 shadow-xl max-w-sm w-full p-6 modal-in">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <h3 className=" text-lg font-semibold text-black">Delete course?</h3>
            <p className="text-sm text-zinc-500 mt-1.5 leading-relaxed">
              This permanently removes <strong className="text-black">"{deleteTarget.title}"</strong> and
              its curriculum. This can't be undone.
            </p>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={busy[deleteTarget.id] === 'delete'}
                className="flex-1 rounded-lg py-2.5 text-sm font-medium border border-black/10 text-zinc-600 hover:bg-zinc-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={busy[deleteTarget.id] === 'delete'}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold bg-black text-white hover:bg-amber-600 transition disabled:opacity-70"
              >
                {busy[deleteTarget.id] === 'delete'
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting…</>
                  : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 toast-in">
          <div className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-lg border
            ${toast.type === 'ok'
              ? 'bg-black text-white border-black'
              : 'bg-white text-black border-amber-300'}`}
          >
            {toast.type === 'ok'
              ? <Check className="h-4 w-4 text-amber-400 shrink-0" />
              : <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />}
            <span>{toast.msg}</span>
            <button onClick={() => setToast(null)} className="ml-1 opacity-60 hover:opacity-100 transition">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <style>{`
        .skeleton {
          background: linear-gradient(90deg, #f4f4f5 25%, #e4e4e7 37%, #f4f4f5 63%);
          background-size: 400% 100%;
          animation: shimmer 1.4s ease infinite;
        }
        @keyframes shimmer {
          0%   { background-position: 100% 50%; }
          100% { background-position: 0 50%; }
        }
        .row-in {
          animation: rowIn 0.35s ease both;
        }
        @keyframes rowIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .modal-backdrop {
          animation: fadeIn 0.18s ease both;
        }
        .modal-in {
          animation: modalIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes fadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .toast-in {
          animation: toastIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .sidebar-backdrop {
          animation: fadeIn 0.18s ease both;
        }
        .sidebar-in {
          animation: sidebarIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes sidebarIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

function ManualAccessPanel({ courses, showToast }) {
  const [form,   setForm]   = useState({ name: '', email: '', phone: '', courseId: '' })
  const [status, setStatus] = useState(null)   // null | { ok, msg }
  const [busy,   setBusy]   = useState(false)

  function field(key) {
    return { value: form[key], onChange: e => setForm(f => ({ ...f, [key]: e.target.value })) }
  }

  async function handleGrant(e) {
    e.preventDefault()
    setBusy(true)
    setStatus(null)
    try {
      await grantAccessOnly({
        name: form.name, email: form.email, phone: form.phone, courseId: form.courseId,
      })
      const course = courses?.find(c => c.id === form.courseId)
      setStatus({
        ok: true,
        msg: `Access granted. Tell ${form.email} to visit ${window.location.origin}/login — they enter their email and phone number to sign in. If it's their first time, the account is created automatically.`,
        courseName: course?.title,
      })
      showToast('ok', `Access granted for ${form.email}.`)
      setForm(f => ({ ...f, name: '', email: '', phone: '' }))
    } catch (err) {
      console.error(err)
      const msg = err.message || 'Something went wrong. Try again.'
      setStatus({ ok: false, msg })
      showToast('error', msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h2 className="font-sans text-2xl font-semibold text-black mb-2">Grant manual access</h2>
      <p className="text-sm text-zinc-500 mb-6 max-w-2xl leading-relaxed">
        For students who paid directly (bank transfer, cash, etc). Their account is
        created automatically when they first sign in at{' '}
        <span className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-xs text-black">/login</span> using
        their email and phone number. No emails sent from your end.
      </p>

      <form
        onSubmit={handleGrant}
        className="bg-white border border-black/10 rounded-xl p-6 max-w-lg space-y-3 shadow-sm"
      >
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-zinc-500 mb-1">
            Student name
          </label>
          <input
            required
            placeholder="Full name"
            className="admin-input"
            {...field('name')}
          />
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-zinc-500 mb-1">
            Student email
          </label>
          <input
            required
            type="email"
            placeholder="their@email.com"
            className="admin-input"
            {...field('email')}
          />
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-zinc-500 mb-1">
            Student phone number
          </label>
          <input
            required
            type="tel"
            placeholder="Their phone number"
            className="admin-input"
            {...field('phone')}
          />
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-zinc-500 mb-1">
            Course
          </label>
          <select
            required
            className="admin-input bg-white"
            {...field('courseId')}
          >
            <option value="">Choose a course…</option>
            {courses?.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        <button
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-black text-white rounded-lg py-2.5 font-medium hover:bg-amber-600 active:scale-[0.98] transition disabled:opacity-60"
        >
          {busy
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Granting access…</>
            : 'Grant access'}
        </button>

        {status && (
          <div className={`rounded-lg p-4 text-sm leading-relaxed flex items-start gap-2.5 status-in
            ${status.ok
              ? 'bg-amber-50 border border-amber-200 text-black'
              : 'bg-zinc-50 border border-black/10 text-black'}`}>
            {status.ok
              ? <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              : <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />}
            <span>{status.msg}</span>
          </div>
        )}
      </form>

      <style>{`
        .admin-input {
          width: 100%;
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 0.5rem;
          padding: 0.625rem 1rem;
          font-size: 0.875rem;
          color: #000;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .admin-input:focus {
          border-color: #d97706;
          box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.12);
        }
        .status-in {
          animation: statusIn 0.25s ease both;
        }
        @keyframes statusIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  )
}