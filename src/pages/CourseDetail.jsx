import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { getCourse, isEnrolled, createPendingOrder } from '../lib/data'
import {
  accountExists,
  writeProfileAndEnrollment,
  activatePendingEnrollments,
} from '../lib/access'
import { useAuth } from '../contexts/AuthContext'

export default function CourseDetail() {
  const { courseId } = useParams()
  const navigate     = useNavigate()
  const { user }     = useAuth()

  const [course,     setCourse]     = useState(null)
  const [enrolled,   setEnrolled]   = useState(false)
  const [form,       setForm]       = useState({ name: '', email: '', phone: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')
  const [paid,       setPaid]       = useState(false)   // existing-user fallback state

  useEffect(() => { getCourse(courseId).then(setCourse) }, [courseId])
  useEffect(() => {
    if (user && courseId) isEnrolled(user.uid, courseId).then(setEnrolled)
  }, [user, courseId])

  if (!course) return <div className="min-h-screen bg-cream" />

  function setField(key) {
    return e => setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function handlePay(e) {
    e.preventDefault()
    setError('')

    if (!form.name || !form.email || !form.phone) {
      setError('Please fill in all three fields.')
      return
    }
    if (form.phone.replace(/\D/g, '').length < 6) {
      setError('Please enter a valid phone number — it will be used to sign in later.')
      return
    }

    setSubmitting(true)

    try {
      const reference = `cp_${courseId}_${Date.now()}`

      await createPendingOrder({
        name: form.name, email: form.email,
        courseId, amount: course.price, reference,
      })

      const handler = window.PaystackPop.setup({
        key:      import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
        email:    form.email,
        amount:   Math.round(course.price * 100),
        currency: course.currency || 'NGN',
        ref:      reference,
        metadata: { name: form.name, courseId },

        callback: async function () {
          try {
            const exists = await accountExists(form.email)

            if (!exists) {
              // ── New user ─────────────────────────────────────────────────
              // createUserWithEmailAndPassword also signs them in immediately.
              const cleanPhone = form.phone.replace(/\D/g, '')
              const cred = await createUserWithEmailAndPassword(auth, form.email, cleanPhone)
              const uid  = cred.user.uid

              await writeProfileAndEnrollment({
                uid, name: form.name, email: form.email,
                courseId, source: 'paystack',
              })
              // Activate any admin pending grants too
              await activatePendingEnrollments(uid, form.email)

              // Signed in and enrolled — go straight to the course
              navigate(`/dashboard/${courseId}`, { replace: true })

            } else {
              // ── Existing user ────────────────────────────────────────────
              // We cannot sign them in here without their password, so save a
              // pending enrollment and redirect them to /login to sign in.
              await setDoc(
                doc(db, 'pendingEnrollments', `${form.email}_${courseId}`),
                {
                  name: form.name, email: form.email,
                  courseId, source: 'paystack',
                  createdAt: serverTimestamp(),
                }
              )
              // Mark order paid
              await setDoc(
                doc(db, 'orders', reference),
                { status: 'paid' },
                { merge: true }
              )
              // Show them the redirect message
              setPaid(true)
              setSubmitting(false)
            }
          } catch (err) {
            console.error(err)
            setError(
              'Payment received but access setup failed. ' +
              'Contact support with your email and we will resolve it immediately.'
            )
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
          <img src={course.coverImage} alt=""
            className="w-full rounded-2xl mt-8 aspect-[16/9] object-cover" />
        )}

        <div className="prose-reader mt-8 text-ink/90 whitespace-pre-line">{course.description}</div>

        {/* Course outline */}
        <h2 className="font-display text-2xl font-semibold mt-12 mb-4">What's inside</h2>
        <div className="space-y-3">
          {(course.curriculum || []).map((mod, i) => (
            <div key={mod.id} className="border border-ink/10 rounded-xl overflow-hidden bg-white">
              <div className="px-5 py-3 bg-parchment/60 font-medium text-sm">
                Module {i + 1}: {mod.title}
              </div>
              <ul className="divide-y divide-ink/5">
                {(mod.lessons || []).map(lesson => (
                  <li key={lesson.id}
                    className="px-5 py-3 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      {lesson.type === 'video' ? '🎬' : '📖'} {lesson.title}
                    </span>
                    <span className="font-mono text-xs text-ash">
                      {!enrolled && '🔒 '}{lesson.durationMin ? `${lesson.durationMin} min` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div id="checkout" className="mt-14 border-t border-ink/10 pt-10">

          {enrolled ? (
            <button
              onClick={() => navigate(`/dashboard/${courseId}`)}
              className="w-full bg-spine text-cream rounded-xl py-4 font-semibold hover:bg-spineLight transition"
            >
              Open course →
            </button>

          ) : paid ? (
            // Existing user who just paid — redirect them to sign in
            <div className="bg-sage/10 border border-sage/30 rounded-xl p-6 space-y-3 text-center">
              <p className="font-display text-xl font-semibold text-sage">Payment received!</p>
              <p className="text-ash text-sm">
                Your access is ready. Sign in with{' '}
                <strong className="text-ink">{form.email}</strong> and your phone number
                to open the course.
              </p>
              <button
                onClick={() => navigate(`/login?redirect=${courseId}`)}
                className="inline-block mt-2 bg-spine text-cream rounded-lg px-6 py-2.5 font-medium hover:bg-spineLight transition text-sm"
              >
                Sign in now →
              </button>
            </div>

          ) : (
            <form onSubmit={handlePay} className="bg-white border border-ink/10 rounded-2xl p-6">
              <div className="flex items-baseline justify-between mb-5">
                <h3 className="font-display text-xl font-semibold">Get instant access</h3>
                <span className="font-semibold text-2xl text-goldDeep">
                  {course.price ? `₦${Number(course.price).toLocaleString()}` : 'Free'}
                </span>
              </div>

              <div className="space-y-3">
                <input
                  required
                  placeholder="Full name"
                  value={form.name}
                  onChange={setField('name')}
                  className="w-full border border-ink/15 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-goldDeep"
                />
                <input
                  required
                  type="email"
                  placeholder="Email address"
                  value={form.email}
                  onChange={setField('email')}
                  className="w-full border border-ink/15 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-goldDeep"
                />
                <div>
                  <input
                    required
                    type="tel"
                    placeholder="Phone number (e.g. 08012345678)"
                    value={form.phone}
                    onChange={setField('phone')}
                    className="w-full border border-ink/15 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-goldDeep"
                  />
                  <p className="text-xs text-ash mt-1.5 ml-1">
                    Your phone number becomes your sign-in password — remember it.
                  </p>
                </div>
              </div>

              {error && (
                <p className="text-red-600 text-sm mt-3">{error}</p>
              )}

              <button
                disabled={submitting}
                className="mt-5 w-full bg-goldDeep text-white rounded-lg py-3.5 font-semibold hover:bg-gold transition disabled:opacity-60"
              >
                {submitting ? 'Opening secure checkout…' : 'Pay with card or bank transfer'}
              </button>

              <p className="text-xs text-ash mt-3 text-center">
                New accounts are opened instantly the moment payment clears.
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}