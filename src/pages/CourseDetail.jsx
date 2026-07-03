import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getCourse, isEnrolled, createPendingOrder } from '../lib/data'
import { grantAccessAndSendLink } from '../lib/access'
import { useAuth } from '../contexts/AuthContext'

export default function CourseDetail() {
  const { courseId }  = useParams()
  const navigate      = useNavigate()
  const { user }      = useAuth()

  const [course,     setCourse]     = useState(null)
  const [enrolled,   setEnrolled]   = useState(false)
  const [form,       setForm]       = useState({ name: '', email: user?.email || '' })
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')
  const [paid,       setPaid]       = useState(false)

  useEffect(() => { getCourse(courseId).then(setCourse) }, [courseId])
  useEffect(() => {
    if (user && courseId) isEnrolled(user.uid, courseId).then(setEnrolled)
  }, [user, courseId])

  if (!course) return <div className="min-h-screen bg-cream" />

  async function handlePay(e) {
    e.preventDefault()
    setError('')
    if (!form.name || !form.email) {
      setError('Please enter your name and email.')
      return
    }
    setSubmitting(true)

    try {
      const reference = `cp_${courseId}_${Date.now()}`

      // Save a pending order to Firestore so you have a record
      await createPendingOrder({
        name:      form.name,
        email:     form.email,
        courseId,
        amount:    course.price,
        reference,
      })

      const handler = window.PaystackPop.setup({
        key:      import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
        email:    form.email,
        amount:   Math.round(course.price * 100), // kobo
        currency: course.currency || 'NGN',
        ref:      reference,
        metadata: { name: form.name, courseId },

        callback: async function () {
          try {
            // Grant access and send the magic link — all client-side, no functions needed
            await grantAccessAndSendLink({
              name:     form.name,
              email:    form.email,
              courseId,
              source:   'paystack',
            })
            setPaid(true)
          } catch (err) {
            console.error(err)
            setError('Payment received but access setup failed. Please contact support.')
          } finally {
            setSubmitting(false)
          }
        },

        onClose: function () {
          setSubmitting(false)
        },
      })

      handler.openIframe()
    } catch (err) {
      console.error(err)
      setError('Something went wrong starting checkout. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-ink/10">
        <div className="max-w-3xl mx-auto px-6 py-5">
          <Link to="/" className="font-display text-xl font-semibold tracking-tight">CoursePress</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-goldDeep mb-3">Course</p>
        <h1 className="font-display text-4xl font-semibold leading-tight">{course.title}</h1>
        <p className="text-lg text-ash mt-3">{course.subtitle}</p>

        {course.coverImage && (
          <img
            src={course.coverImage}
            alt=""
            className="w-full rounded-2xl mt-8 aspect-[16/9] object-cover"
          />
        )}

        <div className="prose-reader mt-8 text-ink/90 whitespace-pre-line">
          {course.description}
        </div>

        {/* Course outline */}
        <h2 className="font-display text-2xl font-semibold mt-12 mb-4">What's inside</h2>
        <div className="space-y-3">
          {(course.curriculum || []).map((mod, i) => (
            <div key={mod.id} className="border border-ink/10 rounded-xl overflow-hidden bg-white">
              <div className="px-5 py-3 bg-parchment/60 font-medium">
                Module {i + 1}: {mod.title}
              </div>
              <ul className="divide-y divide-ink/5">
                {(mod.lessons || []).map(lesson => (
                  <li key={lesson.id} className="px-5 py-3 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      {lesson.type === 'video' ? '🎬' : '📖'} {lesson.title}
                    </span>
                    <span className="font-mono text-xs text-ash">
                      {enrolled ? '' : '🔒'} {lesson.durationMin ? `${lesson.durationMin} min` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Checkout block */}
        <div id="checkout" className="mt-14 border-t border-ink/10 pt-10">
          {enrolled ? (
            <button
              onClick={() => navigate(`/dashboard/${courseId}`)}
              className="w-full bg-spine text-cream rounded-xl py-4 font-medium hover:bg-spineLight transition"
            >
              Go to course →
            </button>
          ) : paid ? (
            <div className="bg-sage/10 border border-sage/30 rounded-xl p-6 text-center">
              <p className="font-display text-xl font-semibold text-sage">You're in!</p>
              <p className="text-ash mt-2 text-sm">
                Check <strong>{form.email}</strong> for your access link. Click it on this
                device to open the course — it signs you straight in, no password needed.
                It may take a minute or two to arrive.
              </p>
            </div>
          ) : (
            <form onSubmit={handlePay} className="bg-white border border-ink/10 rounded-2xl p-6">
              <div className="flex items-baseline justify-between mb-5">
                <h3 className="font-display text-xl font-semibold">Get instant access</h3>
                <span className="font-semibold text-2xl">
                  {course.price ? `₦${Number(course.price).toLocaleString()}` : 'Free'}
                </span>
              </div>
              <div className="space-y-3">
                <input
                  required
                  placeholder="Full name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-ink/15 rounded-lg px-4 py-3 text-sm"
                />
                <input
                  required
                  type="email"
                  placeholder="Email address"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-ink/15 rounded-lg px-4 py-3 text-sm"
                />
              </div>
              {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
              <button
                disabled={submitting}
                className="mt-5 w-full bg-goldDeep text-white rounded-lg py-3.5 font-medium hover:bg-gold transition disabled:opacity-60"
              >
                {submitting ? 'Processing…' : 'Pay with card or bank transfer'}
              </button>
              <p className="text-xs text-ash mt-3 text-center">
                No password needed — your access link arrives by email the moment payment clears.
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
