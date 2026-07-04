import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { listCourses, createCourse, deleteCourse, updateCourse } from '../../lib/data'
import { grantAccessOnly } from '../../lib/access'

export default function AdminDashboard() {
  const { logout } = useAuth()
  const [courses, setCourses] = useState(null)

  function refresh() {
    listCourses({ onlyPublished: false }).then(setCourses)
  }
  useEffect(refresh, [])

  async function handleCreate() {
    const id = await createCourse({ title: 'New course' })
    window.location.href = `/admin/courses/${id}`
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-ink/10">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/admin" className="font-display text-xl font-semibold">
            CoursePress · Admin
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/" className="text-ash hover:text-ink">View site</Link>
            <button onClick={logout} className="hover:text-goldDeep">Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-14">

        {/* ---- Courses ---- */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-display text-2xl font-semibold">Courses</h1>
            <button
              onClick={handleCreate}
              className="bg-spine text-cream rounded-lg px-4 py-2 text-sm font-medium hover:bg-spineLight transition"
            >
              + New course
            </button>
          </div>

          <div className="border border-ink/10 rounded-xl overflow-hidden bg-white divide-y divide-ink/5">
            {courses === null && <p className="p-6 text-ash text-sm">Loading…</p>}
            {courses?.length === 0 && (
              <p className="p-6 text-ash text-sm">No courses yet — create your first one.</p>
            )}
            {courses?.map(c => (
              <div key={c.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium">{c.title}</p>
                  <p className="text-xs text-ash mt-0.5">
                    {c.published
                      ? <span className="text-sage">Published</span>
                      : <span className="text-ash/60">Draft</span>}
                    {' · '}₦{Number(c.price || 0).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <button
                    onClick={() => updateCourse(c.id, { published: !c.published }).then(refresh)}
                    className="text-goldDeep hover:underline"
                  >
                    {c.published ? 'Unpublish' : 'Publish'}
                  </button>
                  <Link to={`/admin/courses/${c.id}`} className="hover:underline">Edit</Link>
                  <button
                    onClick={() => {
                      if (confirm('Delete this course?')) deleteCourse(c.id).then(refresh)
                    }}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Manual access grant ---- */}
        <ManualAccessPanel courses={courses} />
      </main>
    </div>
  )
}

function ManualAccessPanel({ courses }) {
  const [form,   setForm]   = useState({ name: '', email: '', courseId: '' })
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
      await grantAccessOnly({ name: form.name, email: form.email, courseId: form.courseId })
      const course = courses?.find(c => c.id === form.courseId)
      setStatus({
        ok: true,
        msg: `Access granted. Tell ${form.email} to visit ${window.location.origin}/login — they enter their email and phone number to sign in. If it's their first time, the account is created automatically.`,
        courseName: course?.title,
      })
      setForm(f => ({ ...f, name: '', email: '' }))
    } catch (err) {
      console.error(err)
      setStatus({ ok: false, msg: err.message || 'Something went wrong. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h2 className="font-display text-2xl font-semibold mb-2">Grant manual access</h2>
      <p className="text-sm text-ash mb-6 max-w-2xl">
        For students who paid directly (bank transfer, cash, etc). Their account is
        created automatically when they first sign in at{' '}
        <span className="font-mono bg-parchment px-1 rounded text-xs">/login</span> using
        their email and phone number. No emails sent from your end.
      </p>

      <form
        onSubmit={handleGrant}
        className="bg-white border border-ink/10 rounded-xl p-6 max-w-lg space-y-3"
      >
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ash mb-1">
            Student name
          </label>
          <input
            required
            placeholder="Full name"
            className="w-full border border-ink/15 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-goldDeep"
            {...field('name')}
          />
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ash mb-1">
            Student email
          </label>
          <input
            required
            type="email"
            placeholder="their@email.com"
            className="w-full border border-ink/15 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-goldDeep"
            {...field('email')}
          />
        </div>
           <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ash mb-1">
            Student Phone Number
          </label>
          <input
            required
            type="number"
            placeholder="their phone number"
            className="w-full border border-ink/15 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-goldDeep"
            {...field('phone')}
          />
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ash mb-1">
            Course
          </label>
          <select
            required
            className="w-full border border-ink/15 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-goldDeep bg-white"
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
          className="w-full bg-goldDeep text-white rounded-lg py-2.5 font-medium hover:bg-gold transition disabled:opacity-60"
        >
          {busy ? 'Granting…' : 'Grant access'}
        </button>

        {status && (
          <div className={`rounded-lg p-4 text-sm leading-relaxed ${
            status.ok
              ? 'bg-sage/10 border border-sage/20 text-sage'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {status.msg}
          </div>
        )}
      </form>
    </section>
  )
}
