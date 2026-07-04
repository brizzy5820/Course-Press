// src/lib/access.js

import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
} from 'firebase/auth'
import {
  doc, setDoc, getDocs, deleteDoc,
  collection, query, where, serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '../firebase'

// ---------------------------------------------------------------------------
// Write a Firestore user profile + course enrollment for a known uid.
// merge:true on the profile means we never overwrite an existing admin role.
// Enrollment doc ID uid_courseId is deterministic so this is idempotent.
// Pass courseId: null to only write the profile (no enrollment).
// ---------------------------------------------------------------------------
export async function writeProfileAndEnrollment({ uid, name, email, courseId, source }) {
  await setDoc(
    doc(db, 'users', uid),
    { name: name || '', email, role: 'student', createdAt: serverTimestamp() },
    { merge: true }
  )
  if (courseId) {
    await setDoc(doc(db, 'enrollments', `${uid}_${courseId}`), {
      uid, courseId, email, source,
      grantedAt: serverTimestamp(),
    })
  }
}

// ---------------------------------------------------------------------------
// ADMIN MANUAL GRANT
// Writes a pending enrollment keyed by email.
// Does NOT call createUserWithEmailAndPassword — that would sign out the admin.
// When the student signs in at /login for the first time, activatePendingEnrollments()
// converts these into real uid-based enrollment docs automatically.
// ---------------------------------------------------------------------------
export async function grantAccessOnly({ name, email, courseId }) {
  await setDoc(doc(db, 'pendingEnrollments', `${email}_${courseId}`), {
    name: name || '',
    email,
    courseId,
    source: 'manual',
    createdAt: serverTimestamp(),
  })
}

// ---------------------------------------------------------------------------
// Called right after any sign-in or account creation.
// Finds all pendingEnrollments for the user's email, converts each into a
// real enrollment doc keyed by uid, then deletes the pending record.
// ---------------------------------------------------------------------------
export async function activatePendingEnrollments(uid, email) {
  const snap = await getDocs(
    query(collection(db, 'pendingEnrollments'), where('email', '==', email))
  )
  for (const d of snap.docs) {
    const { name, courseId, source } = d.data()
    await writeProfileAndEnrollment({ uid, name, email, courseId, source })
    await deleteDoc(d.ref)
  }
}

// ---------------------------------------------------------------------------
// Returns true if a Firebase Auth account already exists for an email.
// ---------------------------------------------------------------------------
export async function accountExists(email) {
  const methods = await fetchSignInMethodsForEmail(auth, email)
  return methods.length > 0
}
