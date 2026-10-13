import { useEffect, useState } from 'react'
import { updateProfile } from 'firebase/auth'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { Loader2, UserRound } from 'lucide-react'
import { db } from '../firebase'

/**
 * Blocking prompt shown to any signed-in user whose profile has no name yet
 * (first-time sign-ups and older accounts). The name is what gets printed on
 * course certificates, so nothing else is usable until it's provided.
 */
export default function NameRequiredModal({ user, initialName = '' }) {
  const [name,  setName]  = useState(initialName)
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function save(e) {
    e.preventDefault()
    const full = name.trim().replace(/\s+/g, ' ')
    if (full.split(' ').filter(Boolean).length < 2) {
      setError('Please enter your full name — first and last name.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await updateDoc(doc(db, 'users', user.uid), { name: full, nameUpdatedAt: serverTimestamp() })
      try { await updateProfile(user, { displayName: full }) } catch { /* non-critical */ }
      // The auth snapshot picks up the new name and this modal unmounts itself.
    } catch {
      setError('Could not save your name. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm modal-backdrop" />
      <div className="relative card w-full max-w-md p-6 modal-in">
        <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
          <UserRound className="h-5 w-5 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold">One last thing — your name</h2>
        <p className="text-sm text-muted mt-1.5 leading-relaxed">
          Your full name is printed on every course certificate you earn, so we need it before you continue.
        </p>

        <form onSubmit={save} className="mt-5 space-y-3">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Adaeze Chukwuemeka"
            aria-label="Full name"
            className="input"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Save and continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
