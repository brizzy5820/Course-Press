// src/lib/access.js
//
// Handles account creation, enrollment, and magic sign-in link entirely
// client-side using the Firebase SDK. No Cloud Functions or Blaze plan needed.

import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  sendSignInLinkToEmail,
} from 'firebase/auth'
import {
  doc, setDoc, getDocs, collection, query, where, serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '../firebase'

function actionCodeSettings() {
  return {
    url: `${window.location.origin}/login`,
    handleCodeInApp: true,
  }
}

// ---------------------------------------------------------------------------
// Call this after a successful Paystack payment OR from the admin manual
// grant form. It:
//   1. Creates a Firebase Auth account if one doesn't exist yet
//   2. Writes their Firestore user profile (won't overwrite admin role)
//   3. Enrolls them in the course
//   4. Sends a passwordless sign-in link to their email
// ---------------------------------------------------------------------------
export async function grantAccessAndSendLink({ name, email, courseId, source }) {
  let uid

  // 1. Check if a Firebase Auth account already exists for this email
  const methods = await fetchSignInMethodsForEmail(auth, email)

  if (methods.length === 0) {
    // No account yet — create one with a random password they'll never use
    const randomPass = Math.random().toString(36).slice(2, 10) +
                       Math.random().toString(36).slice(2, 10)
    const cred = await createUserWithEmailAndPassword(auth, email, randomPass)
    uid = cred.user.uid
  } else {
    // Account exists — find their UID from the users collection by email
    const q    = query(collection(db, 'users'), where('email', '==', email))
    const snap = await getDocs(q)
    if (!snap.empty) {
      uid = snap.docs[0].id
    } else {
      // Auth account exists but no Firestore doc yet — sign them in temporarily
      // to get the UID (this happens only in rare edge cases)
      throw new Error(
        `Account exists for ${email} but no Firestore profile found. ` +
        `Ask them to sign in once at /login first.`
      )
    }
  }

  // 2. Write Firestore user profile
  // merge: true means we won't overwrite the role field if they're already an admin
  await setDoc(doc(db, 'users', uid), {
    name:      name || '',
    email,
    role:      'student',
    createdAt: serverTimestamp(),
  }, { merge: true })

  // 3. Enroll in course — doc ID is uid_courseId so it's always idempotent
  await setDoc(doc(db, 'enrollments', `${uid}_${courseId}`), {
    uid,
    courseId,
    email,
    source,
    grantedAt: serverTimestamp(),
  })

  // 4. Save email to localStorage so the sign-in page can complete the flow,
  //    then send the magic link
  window.localStorage.setItem('coursepress_email', email)
  await sendSignInLinkToEmail(auth, email, actionCodeSettings())

  return uid
}
