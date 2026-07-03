import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { listCourses, createCourse, deleteCourse, updateCourse } from '../../lib/data'
import { grantAccessAndSendLink } from '../../lib/access'

export default function AdminDashboard() {
  const { user, logout } = useAuth()
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

        {/* Course list */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-display text-2xl font-semibold">Courses</h1>
            <button
              onClick={handleCreate}
              className="bg-spine text-cream rounded-lg px-4 py-2 text-sm font-medium hover:bg-spineLight"
            >
              + New course
            </button>
          </div>

          <div className="border border-ink/10 rounded-xl overflow-hidden bg-white divide-y divide-ink/5">
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
                      : <span className="text-ash">Draft</span>}
                    {' · '}₦{Number(c.price || 0).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <button
                    onClick={() => updateCourse(c.id, { published: !c.published }).then(refresh)}
                    className="text-goldDeep hover:underline"
                  >
                    {c.published ? 'Unpublish' : 'Publish'}
                  </button>
                  <Link to={`/admin/courses/${c.id}`} className="text-ink hover:underline">
                    Edit
                  </Link>
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

        {/* Manual access grant */}
        <ManualAccessPanel courses={courses} />
      </main>
    </div>
  )
}

function ManualAccessPanel({ courses }) {
  const [form,   setForm]   = useState({ name: '', email: '', courseId: '' })
  const [status, setStatus] = useState('')
  const [busy,   setBusy]   = useState(false)

  async function handleGrant(e) {
    e.preventDefault()
    setBusy(true)
    setStatus('')
    try {
      await grantAccessAndSendLink({
        name:     form.name,
        email:    form.email,
        courseId: form.courseId,
        source:   'manual',
      })
      setStatus(`Done — access granted and email sent to ${form.email}.`)
      setForm(f => ({ ...f, name: '', email: '' }))
    } catch (err) {
      console.error(err)
      setStatus('Something went wrong. Check the details and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h2 className="font-display text-2xl font-semibold mb-2">Grant manual access</h2>
      <p className="text-sm text-ash mb-6 max-w-xl">
        For readers who paid you directly — bank transfer to your account, cash, etc.
        This creates their account if needed and emails them their access link
        automatically.
      </p>
      <form
        onSubmit={handleGrant}
        className="bg-white border border-ink/10 rounded-xl p-6 max-w-lg space-y-3"
      >
        <input
          required
          placeholder="Reader's full name"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="w-full border border-ink/15 rounded-lg px-4 py-2.5 text-sm"
        />
        <input
          required
          type="email"
          placeholder="Reader's email"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          className="w-full border border-ink/15 rounded-lg px-4 py-2.5 text-sm"
        />
        <select
          required
          value={form.courseId}
          onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))}
          className="w-full border border-ink/15 rounded-lg px-4 py-2.5 text-sm"
        >
          <option value="">Choose a course…</option>
          {courses?.map(c => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <button
          disabled={busy}
          className="w-full bg-goldDeep text-white rounded-lg py-2.5 font-medium hover:bg-gold transition disabled:opacity-60"
        >
          {busy ? 'Granting access…' : 'Grant access & send link'}
        </button>
        {status && <p className="text-sm text-ash pt-1">{status}</p>}
      </form>
    </section>
  )
}
