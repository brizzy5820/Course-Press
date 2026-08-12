import { useEffect, useState } from 'react'
import {
  ChevronRight, Loader, LogOut, Moon, Pencil,
  Sun, Trash2, User, X,
} from 'lucide-react'
import { deleteDoc, doc, updateDoc } from 'firebase/firestore'
import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  updateProfile,
} from 'firebase/auth'
import { auth, db } from '../firebase'

function AccountPanel({ open, onClose, user, profile, onLogout, navigate, toast, theme, toggleTheme }) {
  const [view,       setView]       = useState('menu')
  const [name,       setName]       = useState('')
  const [phone,      setPhone]      = useState('')
  const [busy,       setBusy]       = useState(false)
  const [error,      setError]      = useState('')
  const [deleteStep, setDeleteStep] = useState(1)

  useEffect(() => {
    if (open) {
      setView('menu')
      setName(profile?.name || '')
      setPhone('')
      setError('')
      setBusy(false)
      setDeleteStep(1)
    }
  }, [open, profile])

  async function handleSaveName(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Name cannot be empty.')
    setBusy(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), { name: name.trim() })
      await updateProfile(auth.currentUser, { displayName: name.trim() })
      toast('Name updated successfully.', 'success')
      onClose()
    } catch {
      setError('Could not update name. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(e) {
    e.preventDefault()
    setError('')
    if (!phone.trim()) return setError('Enter your phone number to confirm.')
    setBusy(true)
    try {
      const cleanPhone = normalizePhone(phone)
      const credential = EmailAuthProvider.credential(user.email, cleanPhone)
      await reauthenticateWithCredential(auth.currentUser, credential)
      await deleteDoc(doc(db, 'users', user.uid))
      await deleteUser(auth.currentUser)
      toast('Your account has been deleted.', 'info')
      navigate('/', { replace: true })
    } catch (err) {
      if (
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setError('Incorrect phone number. Your account was not deleted.')
      } else {
        setError('Could not delete account. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const heading = view === 'menu' ? 'Account'
    : view === 'name'             ? 'Change name'
    :                               'Delete account'

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[2px]" />

      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[340px] bg-white dark:bg-neutral-900 shadow-2xl flex flex-col">

        {/* Panel header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            {view !== 'menu' && (
              <button
                onClick={() => { setView('menu'); setError('') }}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition mr-1"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>
            )}
            <h2 className="font-semibold text-neutral-950 dark:text-white text-base">{heading}</h2>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── MENU ── */}
        {view === 'menu' && (
          <div className="flex-1 overflow-y-auto">
            {/* Profile summary */}
            <div className="px-6 py-5 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-black dark:bg-amber-500 text-white dark:text-black flex items-center justify-center text-sm font-semibold shrink-0">
                  {(profile?.name || user?.email || '?')
                    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-900 dark:text-white text-sm truncate">
                    {profile?.name || '—'}
                  </p>
                  <p className="text-xs text-neutral-400 truncate">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Menu items */}
            <nav className="px-3 py-3 space-y-0.5">
              <PanelItem
                icon={<Pencil className="h-4 w-4" />}
                label="Change name"
                onClick={() => { setView('name'); setError('') }}
              />
              <PanelItem
                icon={<User className="h-4 w-4" />}
                label="Account email"
                sublabel={user?.email}
              />
              {/* Theme toggle */}
              <PanelItem
                icon={theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                label={`Theme: ${theme === 'dark' ? 'Dark' : 'Light'}`}
                sublabel="Toggle app theme"
                onClick={toggleTheme}
              />
              <div className="pt-2 mt-2 border-t border-neutral-100 dark:border-neutral-800">
                <PanelItem
                  icon={<LogOut className="h-4 w-4" />}
                  label="Sign out"
                  onClick={onLogout}
                />
                <PanelItem
                  icon={<Trash2 className="h-4 w-4" />}
                  label="Delete account"
                  destructive
                  onClick={() => { setView('delete'); setError(''); setDeleteStep(1) }}
                />
              </div>
            </nav>
          </div>
        )}

        {/* ── CHANGE NAME ── */}
        {view === 'name' && (
          <form onSubmit={handleSaveName} className="flex-1 flex flex-col px-6 py-6">
            <label className="block">
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                Full name
              </span>
              <input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                className="mt-2 w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm text-neutral-900 dark:text-white bg-white dark:bg-neutral-800 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-50 dark:focus:ring-amber-900/20 transition"
              />
            </label>
            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
            <div className="flex gap-3 mt-auto pt-6">
              <button
                type="button"
                onClick={() => setView('menu')}
                className="flex-1 border border-neutral-200 dark:border-neutral-700 rounded-xl py-3 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 bg-black dark:bg-amber-500 text-white dark:text-black rounded-xl py-3 text-sm font-semibold hover:bg-neutral-800 dark:hover:bg-amber-400 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? <><Loader className="h-4 w-4 animate-spin" /> Saving…</> : 'Save'}
              </button>
            </div>
          </form>
        )}

        {/* ── DELETE ACCOUNT ── */}
        {view === 'delete' && (
          <div className="flex-1 flex flex-col px-6 py-6 overflow-y-auto">
            {deleteStep === 1 && (
              <>
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                    <Trash2 className="h-4 w-4 shrink-0" />
                    <p className="font-semibold text-sm">This is permanent</p>
                  </div>
                  <ul className="text-xs text-red-600 dark:text-red-400 space-y-1.5 list-disc list-inside leading-relaxed">
                    <li>Your account will be permanently deleted</li>
                    <li>All course access will be removed immediately</li>
                    <li>Your progress cannot be recovered</li>
                    <li>This action cannot be undone</li>
                  </ul>
                </div>
                <div className="flex gap-3 mt-auto pt-6">
                  <button
                    onClick={() => setView('menu')}
                    className="flex-1 border border-neutral-200 dark:border-neutral-700 rounded-xl py-3 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
                  >
                    Keep account
                  </button>
                  <button
                    onClick={() => setDeleteStep(2)}
                    className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-red-700 transition"
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {deleteStep === 2 && (
              <form onSubmit={handleDelete} className="flex flex-col flex-1">
                <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed mb-5">
                  Enter your <strong>phone number</strong> to confirm deletion.
                  This is the phone number you use to sign in.
                </p>
                <label className="block">
                  <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                    Phone number
                  </span>
                  <input
                    required
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="08012345678 or +2348012345678"
                    className="mt-2 w-full border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-50 dark:focus:ring-red-900/20 transition"
                  />
                </label>
                {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
                <div className="flex gap-3 mt-auto pt-6">
                  <button
                    type="button"
                    onClick={() => setDeleteStep(1)}
                    className="flex-1 border border-neutral-200 dark:border-neutral-700 rounded-xl py-3 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {busy
                      ? <><Loader className="h-4 w-4 animate-spin" /> Deleting…</>
                      : 'Delete account'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function normalizePhone(raw) {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('234') && digits.length >= 13) {
    digits = '0' + digits.slice(3)
  }
  return digits
}

function PanelItem({ icon, label, sublabel, onClick, destructive = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-start gap-3 rounded-2xl px-4 py-3 text-left text-sm transition
        ${destructive
          ? 'text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/40'
          : 'text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
    >
      <span className="mt-1 h-5 w-5 text-current">{icon}</span>
      <span className="min-w-0">
        <span className="font-medium block">{label}</span>
        {sublabel && <span className="text-xs text-neutral-500 dark:text-neutral-400">{sublabel}</span>}
      </span>
    </button>
  )
}

export default AccountPanel