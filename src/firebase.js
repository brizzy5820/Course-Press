// src/firebase.js
//
// 1. Go to https://console.firebase.google.com -> Create project.
// 2. Add a Web App, copy the config object Firebase gives you, and paste
//    the values into a `.env` file at the project root (see `.env.example`).
// 3. In the Firebase console enable:
//      - Authentication -> Sign-in method -> Email link (passwordless) AND Email/Password
//      - Firestore Database (production mode)
//      - Storage
// 4. Deploy `firestore.rules` and `storage.rules` (see README) so reads/writes are locked down.

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
// import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
// export const storage = getStorage(app)

// Public base URL of your deployed Cloud Functions (see /functions).
// e.g. https://us-central1-your-project.cloudfunctions.net
export const FUNCTIONS_BASE_URL = import.meta.env.VITE_FUNCTIONS_BASE_URL
