import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import {
  PlayCircle, FileText, Lock, Clock,
  CheckCircle2, ArrowRight, Loader2,
} from 'lucide-react'
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
  const [paid,       setPaid]       = useState(false)

  useEffect(() => { getCourse(courseId).then(setCourse) }, [courseId])
  useEffect(() => {
    if (user && courseId) isEnrolled(user.uid, courseId).then(setEnrolled)
  }, [user, courseId])

  if (!course) return (
    <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
    </div>
  )

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
            const exists     = await accountExists(form.email)
            const cleanPhone = form.phone.replace(/\D/g, '')
            if (!exists) {
              const cred = await createUserWithEmailAndPassword(auth, form.email, cleanPhone)
              const uid  = cred.user.uid
              await writeProfileAndEnrollment({ uid, name: form.name, email: form.email, courseId, source: 'paystack' })
              await activatePendingEnrollments(uid, form.email)
              navigate(`/dashboard/${courseId}`, { replace: true })
            } else {
              await setDoc(doc(db, 'pendingEnrollments', `${form.email}_${courseId}`), {
                name: form.name, email: form.email, courseId,
                source: 'paystack', createdAt: serverTimestamp(),
              })
              await setDoc(doc(db, 'orders', reference), { status: 'paid' }, { merge: true })
              setPaid(true)
              setSubmitting(false)
            }
          } catch (err) {
            console.error(err)
            setError('Payment received but access setup failed. Contact support with your email.')
            setSubmitting(false)
          }
        },
        onClose: function () { setSubmitting(false) },
      })
      handler.openIframe()
    } catch (err) {
      console.error(err)
      setError('Something went wrong starting checkout. Please try again.')
      setSubmitting(false)
    }
  }

  const totalLessons = (course.curriculum || []).reduce((s, m) => s + (m.lessons?.length || 0), 0)

  return (
    <div className="min-h-screen bg-[#F7F8FA]">

      {/* Header */}
      <header className="bg-white border-b border-zinc-200 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-bold text-black text-lg tracking-tight">CoursePress</Link>
          {user ? (
            <Link to="/dashboard" className="text-sm font-medium text-zinc-600 hover:text-black transition flex items-center gap-1.5">
              My library <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <Link
              to="/login"
              className="text-sm font-semibold text-black hover:text-black transition"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">

        {/* Hero */}
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Course</p>
        <h1 className="font-sans text-2xl lg:text-4xl font-semibold leading-tight text-black">{course.title}</h1>
        <p className="text-lg text-zinc-600 mt-3 leading-relaxed">{course.subtitle}</p>

        {/* Stats */}
         <div className="flex flex-wrap items-center gap-2 mt-6">
            <StatPill icon={<FileText className="h-3.5 w-3.5" />} label={`${totalLessons} lessons`} />
            <StatPill icon={<Clock className="h-3.5 w-3.5" />} label="Self-paced" />
            <StatPill icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Lifetime access" />
          </div>

        {/* Cover */}
        {course.coverImage && (
          <img
            src={course.coverImage}
            alt={course.title}
            className="w-full rounded-2xl mt-8 aspect-[16/9] object-cover shadow-sm"
          />
        )}

        {/* Description */}
        {course.description && (
          <div className="prose-reader mt-8 text-black/80 whitespace-pre-line leading-[1.85] text-[1.02rem]">
            {course.description}
          </div>
        )}

        {/* Curriculum */}
        <h2 className="font-sans text-2xl font-semibold mt-12 mb-4 text-black">What's inside</h2>
        <div className="space-y-3">
          {(course.curriculum || []).map((mod, mi) => (
            <div key={mod.id} className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
              <div className="px-5 py-3 bg-zinc-100 flex items-center gap-2">
                <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider">Module {mi + 1}</span>
                <span className="text-zinc-300">·</span>
                <span className="text-sm font-semibold text-black">{mod.title}</span>
                <span className="ml-auto font-mono text-xs text-zinc-500">{mod.lessons?.length || 0} lessons</span>
              </div>
              <ul className="divide-y divide-zinc-100">
                {(mod.lessons || []).map((lesson, li) => (
                  <li key={lesson.id} className="px-5 py-3 flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-[10px] text-zinc-500 shrink-0 w-6">{mi + 1}.{li + 1}</span>
                      {lesson.type === 'video'
                        ? <PlayCircle className="h-3.5 w-3.5 text-zinc-700 shrink-0" />
                        : <FileText   className="h-3.5 w-3.5 text-zinc-700 shrink-0" />}
                      <span className="text-black truncate">{lesson.title}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      {!enrolled && <Lock className="h-3 w-3 text-zinc-400" />}
                      {lesson.durationMin && (
                        <span className="font-mono text-xs text-zinc-500">{lesson.durationMin}m</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div id="checkout" className="mt-14 border-t border-zinc-200 pt-10">
          {enrolled ? (
            <button
              onClick={() => navigate(`/dashboard/${courseId}`)}
              className="w-full bg-black text-white rounded-xl py-4 font-semibold hover:bg-zinc-800 transition flex items-center justify-center gap-2"
            >
              Open course <ArrowRight className="h-4 w-4" />
            </button>

          ) : paid ? (
            <div className="bg-zinc-100 border border-zinc-300 rounded-2xl p-7 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-zinc-200 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6 text-black" />
              </div>
              <p className="font-display text-xl font-semibold text-black">Payment received!</p>
              <p className="text-zinc-600 text-sm leading-relaxed">
                Your access is ready. Sign in with{' '}
                <strong className="text-black">{form.email}</strong> and your phone number.
              </p>
              <button
                onClick={() => navigate(`/login?redirect=${courseId}`)}
                className="inline-flex items-center gap-2 mt-2 bg-black text-white rounded-lg px-6 py-2.5 font-semibold hover:bg-zinc-800 transition text-sm"
              >
                Sign in now <ArrowRight className="h-4 w-4" />
              </button>
            </div>

          ) : (
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-baseline justify-between mb-6">
                <h3 className="font-display text-xl font-semibold text-black">Get instant access</h3>
                <span className="font-bold text-2xl text-black">
                  {course.price ? `₦${Number(course.price).toLocaleString()}` : 'Free'}
                </span>
              </div>

              <form onSubmit={handlePay} className="space-y-3">
                <input
                  required
                  placeholder="Full name"
                  value={form.name}
                  onChange={setField('name')}
                  className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-black/10 transition"
                />
                <input
                  required
                  type="email"
                  placeholder="Email address"
                  value={form.email}
                  onChange={setField('email')}
                  className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-black/10 transition"
                />
                <div>
                  <input
                    required
                    type="tel"
                    placeholder="Phone number (e.g. 08012345678)"
                    value={form.phone}
                    onChange={setField('phone')}
                    className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-black/10 transition"
                  />
                  <p className="text-xs text-zinc-500 mt-2 ml-1 flex items-center gap-1.5">
                    <Lock className="h-3 w-3" />
                    Your phone number becomes your sign-in password — remember it.
                  </p>
                </div>

                {error && (
                  <div className="bg-zinc-100 border border-zinc-300 rounded-xl px-4 py-3 text-sm text-black">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-black text-white rounded-xl py-3.5 font-semibold hover:bg-zinc-800 transition disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                >
                  {submitting
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Opening checkout…</>
                    : 'Pay with card or bank transfer'}
                </button>

                <p className="text-xs text-zinc-500 text-center pt-1">
                  New accounts are opened instantly the moment payment clears.
                </p>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
function StatPill({ icon, label }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 bg-white border border-zinc-200 rounded-full px-3 py-1.5">
      {icon} {label}
    </span>
  )
}
 