import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { sendSignInLinkToEmail } from 'firebase/auth'
import { auth } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

const ACTION_CODE_SETTINGS = {
  url: `${window.location.origin}/login`,
  handleCodeInApp: true,
}

export default function Login() {
  const { user, loading } = useAuth()
  const [email,  setEmail]  = useState('')
  const [sent,   setSent]   = useState(false)
  const [error,  setError]  = useState('')
  const [busy,   setBusy]   = useState(false)

  if (!loading && user) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      window.localStorage.setItem('coursepress_email', email)
      await sendSignInLinkToEmail(auth, email, ACTION_CODE_SETTINGS)
      setSent(true)
    } catch (err) {
      console.error(err)
      setError("We couldn't send that link. Double-check the email you used to buy.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-spine flex items-center justify-center px-6">
      <div className="max-w-sm w-full">
        <Link to="/" className="font-display text-xl font-semibold text-cream block text-center mb-8">
          CoursePress
        </Link>
        <div className="bg-spineLight rounded-2xl p-7 border border-white/5">
          {sent ? (
            <div className="text-center">
              <p className="font-display text-xl font-semibold text-cream">Check your inbox</p>
              <p className="text-cream/60 text-sm mt-2">
                We sent a sign-in link to{' '}
                <strong className="text-cream">{email}</strong>.
                Open it on this device to get into your course.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h1 className="font-display text-xl font-semibold text-cream mb-1">Sign in</h1>
              <p className="text-cream/50 text-sm mb-5">
                Enter the email you purchased with — we'll send a fresh access link.
              </p>
              <input
                required
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg bg-spine border border-white/10 text-cream px-4 py-3 text-sm placeholder:text-cream/30"
              />
              {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
              <button
                disabled={busy}
                className="mt-4 w-full bg-gold text-spine font-medium rounded-lg py-3 hover:bg-goldDeep transition disabled:opacity-60"
              >
                {busy ? 'Sending…' : 'Email me an access link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
