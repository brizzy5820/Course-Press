// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged, isSignInWithEmailLink, signInWithEmailLink, signOut,
} from 'firebase/auth'
import { auth } from '../firebase'
import { ensureUserDoc, getUserProfile } from '../lib/data'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Handle the "magic link" the access-email sends. Firebase requires the
    // sign-in to happen on the same URL the link points to (see /auth/complete).
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const params = new URLSearchParams(window.location.search)
      const email = window.localStorage.getItem('coursepress_email') || params.get('email')
      if (email) {
        signInWithEmailLink(auth, email, window.location.href)
          .then(() => window.localStorage.removeItem('coursepress_email'))
          .catch(console.error)
      }
    }

    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        const p = await ensureUserDoc(u.uid, { name: u.displayName || '', email: u.email })
        setProfile(p)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  async function refreshProfile() {
    if (user) setProfile(await getUserProfile(user.uid))
  }

  async function logout() {
    await signOut(auth)
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, refreshProfile, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
