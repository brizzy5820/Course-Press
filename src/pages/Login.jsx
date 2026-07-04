import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import { auth } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { activatePendingEnrollments } from '../lib/access'

// Strip everything that isn't a digit so "080 123 4567" and "08012345678"
// both resolve to the same password string "08012345678".
function normalizePhone(raw) {
  return raw.replace(/\D/g, '')
}

const validateEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

export default function Login() {
  const { user, loading } = useAuth()
  const navigate          = useNavigate()
  const [params]          = useSearchParams()
  const redirectCourse    = params.get('redirect')

  const [email,   setEmail]   = useState('')
  const [phone,   setPhone]   = useState('')
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState('')
  const [mode,    setMode]    = useState('login')   // 'login' | 'reset'
  const [resetOk, setResetOk] = useState(false)

  if (!loading && user) {
    return <Navigate to={redirectCourse ? `/dashboard/${redirectCourse}` : '/dashboard'} replace />
  }

  function fail(msg) {
    setError(msg)
    setBusy(false)
  }

  // ── Sign in ──────────────────────────────────────────────────────────────
  // Strategy: try signIn first. If Firebase says "invalid credential" OR
  // "user not found", attempt createUserWithEmailAndPassword — this covers
  // first-time sign-in for admin-granted users whose account doesn't exist
  // yet. If creation fails with "email already in use", the account exists
  // but the phone was wrong, so we surface a clear password error.
  //
  // We intentionally do NOT call fetchSignInMethodsForEmail because Firebase
  // may have email-enumeration-protection enabled which makes it always
  // return an empty array, making it unreliable.
  // ─────────────────────────────────────────────────────────────────────────
  async function handleSignIn(e) {
    e.preventDefault()
    setError('')

    const em = email.trim()
    const ph = normalizePhone(phone)

    if (!em || !validateEmail(em)) return fail('Enter a valid email address.')
    if (ph.length < 6)             return fail('Phone number must be at least 6 digits.')

    setBusy(true)

    try {
      // ── Step 1: try signing in ──
      const cred = await signInWithEmailAndPassword(auth, em, ph)
      await activatePendingEnrollments(cred.user.uid, em)
      navigate(redirectCourse ? `/dashboard/${redirectCourse}` : '/dashboard', { replace: true })

    } catch (signInErr) {
      const isNotFound = [
        'auth/user-not-found',
        'auth/invalid-credential',
        'auth/invalid-email',
      ].includes(signInErr.code)

      const isWrongPass = signInErr.code === 'auth/wrong-password'
      const isTooMany   = signInErr.code === 'auth/too-many-requests'

      if (isTooMany) {
        return fail('Too many attempts. Please wait a few minutes and try again.')
      }

      if (isWrongPass) {
        return fail('Incorrect phone number. Use "Forgot password" if you need to reset it.')
      }

      if (isNotFound) {
        // ── Step 2: no account found — try creating one ──
        // This succeeds for admin-granted users signing in for the first time.
        try {
          const cred = await createUserWithEmailAndPassword(auth, em, ph)
          await activatePendingEnrollments(cred.user.uid, em)
          navigate(redirectCourse ? `/dashboard/${redirectCourse}` : '/dashboard', { replace: true })

        } catch (createErr) {
          if (createErr.code === 'auth/email-already-in-use') {
            // Account exists — the sign-in above failed with "invalid credential"
            // (newer SDK behaviour) meaning the phone was genuinely wrong.
            return fail('Incorrect phone number. Use "Forgot password" if you need to reset it.')
          }
          if (createErr.code === 'auth/weak-password') {
            return fail('Phone number must be at least 6 digits.')
          }
          return fail('Sign-in failed. Check your details and try again.')
        }
      } else {
        fail('Sign-in failed. Check your details and try again.')
      }
    }
  }

  // ── Forgot password ──────────────────────────────────────────────────────
  async function handleReset(e) {
    e.preventDefault()
    setError('')

    const em = email.trim()
    if (!em || !validateEmail(em)) return fail('Enter a valid email address.')

    setBusy(true)
    try {
      await sendPasswordResetEmail(auth, em)
      setResetOk(true)
      setBusy(false)
    } catch (err) {
      if (err.code === 'auth/user-not-found') return fail('No account found for that email.')
      if (err.code === 'auth/invalid-email')   return fail('Enter a valid email address.')
      fail('Could not send reset email. Please try again.')
    }
  }

  function goReset()  { setMode('reset');  setError(''); setResetOk(false) }
  function goLogin()  { setMode('login');  setError(''); setResetOk(false) }

  return (
    <div className="min-h-screen bg-cream px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-xl">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)]">

          {/* ── Header ── */}
          <div className="bg-slate-950 px-8 py-10 text-center sm:px-10">
            <Link to="/" className="inline-flex items-center justify-center gap-3 text-cream">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-gold/10 text-gold shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span className="font-display text-2xl font-semibold">CoursePress</span>
            </Link>
            <div className="mt-6">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-white">
                {mode === 'login' ? 'Welcome back' : 'Reset your password'}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-300/90">
                {mode === 'login'
                  ? 'Sign in to access your courses and continue learning.'
                  : 'Enter your email and we\'ll send you a reset link.'}
              </p>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="px-6 py-8 sm:px-10">

            {/* Sign in */}
            {mode === 'login' && (
              <form onSubmit={handleSignIn} className="space-y-6">
                <Field label="Email address">
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="input-light"
                  />
                </Field>

                <Field label="Phone number" hint="This is your password.">
                  <input
                    required
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="08012345678"
                    autoComplete="tel"
                    className="input-light"
                  />
                </Field>

                {error && <Alert>{error}</Alert>}

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : 'Sign in'}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={goReset}
                    className="text-sm text-slate-500 transition hover:text-ink underline underline-offset-2"
                  >
                    Forgot your phone number?
                  </button>
                </div>
              </form>
            )}

            {/* Reset form */}
            {mode === 'reset' && !resetOk && (
              <form onSubmit={handleReset} className="space-y-6">
                <Field label="Email address">
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="input-light"
                  />
                </Field>

                {error && <Alert>{error}</Alert>}

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : 'Send reset link'}
                </button>

                <div className="text-center">
                  <button type="button" onClick={goLogin}
                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink transition">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
                  </button>
                </div>
              </form>
            )}

            {/* Reset success */}
            {mode === 'reset' && resetOk && (
              <div className="space-y-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sage/10 text-sage">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-ink">Check your inbox</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Reset link sent to <span className="font-semibold text-ink">{email}</span>.
                    After resetting, use your new password to sign in.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={goLogin}
                  className="rounded-3xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-slate-50"
                >
                  Back to sign in
                </button>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="bg-slate-950 px-8 py-5 text-center sm:px-10">
            <p className="text-sm leading-6 text-slate-400">
              New here?{' '}
              <Link to="/" className="font-semibold text-white hover:text-gold transition">
                Browse courses
              </Link>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .input-light {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 0.875rem;
          padding: 0.75rem 1rem;
          background: #f8fafc;
          color: #0f172a;
          font-size: 0.9rem;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
          outline: none;
        }
        .input-light::placeholder { color: #94a3b8; }
        .input-light:focus {
          border-color: #e8a33d;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(232,163,61,0.15);
        }
      `}</style>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Alert({ children }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {children}
    </div>
  )
}