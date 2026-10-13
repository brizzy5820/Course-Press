import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'
import NameRequiredModal from '../components/NameRequiredModal'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let profileUnsub = () => {}

    const authUnsub = onAuthStateChanged(auth, firebaseUser => {
      // Clean up any previous profile listener immediately
      profileUnsub()
      setUser(firebaseUser)
      setProfile(null)

      if (firebaseUser) {
        // Subscribe to the user's Firestore profile in real-time
        profileUnsub = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          async snap => {
            if (snap.exists() && snap.data().removed) {
              // Admin removed this user from the site: end the session.
              setProfile(null)
              firebaseSignOut(auth)
            } else if (snap.exists()) {
              setProfile({ uid: snap.id, ...snap.data() })
            } else {
              // Profile doc doesn't exist yet — create it.
              // This covers the edge case where Auth account exists but
              // Firestore write in CourseDetail failed or was interrupted.
              await setDoc(
                doc(db, 'users', firebaseUser.uid),
                {
                  name:      firebaseUser.displayName || '',
                  email:     firebaseUser.email       || '',
                  role:      'student',
                  createdAt: serverTimestamp(),
                },
                { merge: true }
              )
              // The setDoc above will trigger another snapshot which will
              // hit the snap.exists() branch and set the profile correctly.
            }
            setLoading(false)
          },
          () => {
            // Snapshot error (e.g. permission denied during logout transition)
            setLoading(false)
          }
        )
      } else {
        // Signed out — clear everything
        setLoading(false)
      }
    })

    return () => {
      authUnsub()
      profileUnsub()
    }
  }, [])

  const logout = async () => {
    await firebaseSignOut(auth)
  }

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    logout,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user, profile, loading])

  // Every signed-in user needs a name (certificates are printed with it).
  // First-time sign-ups and older accounts without one are asked right here,
  // before they can use anything else.
  const needsName = !loading && !!user && !!profile && !profile.removed && !String(profile.name || '').trim()

  return (
    <AuthContext.Provider value={value}>
      {children}
      {needsName && (
        <NameRequiredModal user={user} initialName={user.displayName || ''} />
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}