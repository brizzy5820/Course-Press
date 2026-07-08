// src/firebase.js
//
// Firebase services used in this project:
//   - Authentication  (email/password + passwordless reset)
//   - Firestore       (all data: courses, users, enrollments, progress, orders)
//
// Firebase Storage is NOT used — cover images and downloadable files
// go to Cloudinary (free 25 GB, configured in CourseEditor.jsx).

import { initializeApp }  from 'firebase/app'
import { getAuth }        from 'firebase/auth'
import { getFirestore }   from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app  = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db   = getFirestore(app)

// Base URL of deployed Cloud Functions (optional — only needed if you
// later deploy functions for Paystack webhooks).
export const FUNCTIONS_BASE_URL = import.meta.env.VITE_FUNCTIONS_BASE_URL || ''