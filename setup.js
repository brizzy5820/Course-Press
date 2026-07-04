// Run once with: node setup.js
// Requires your .env to be filled in first

import { initializeApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

const ADMIN_EMAIL = 'boluwatifedavid@gmail.com'    // ← change this
const ADMIN_NAME  = 'Egbeyemi Boluwatife david'               // ← change this
const ADMIN_PASS  = '08106146952'    // ← change this (min 6 chars)

const app  = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db   = getFirestore(app)

async function setup() {
  console.log('Creating or updating admin account...')
  let user
  try {
    const cred = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASS)
    user = cred.user
  } catch (err) {
    if (err?.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASS)
      user = cred.user
    } else {
      throw err
    }
  }
  const uid = user.uid

  console.log('Writing admin profile to Firestore...')
  await setDoc(doc(db, 'users', uid), {
    name:      ADMIN_NAME,
    email:     ADMIN_EMAIL,
    role:      'admin',
    createdAt: serverTimestamp(),
  }, { merge: true })

  console.log('✅ Done. Admin account created.')
  console.log('   Email:   ', ADMIN_EMAIL)
  console.log('   UID:     ', uid)
  console.log('   Role:    admin')
  console.log('')
  console.log('You can now sign in at /login using this email.')
  console.log('The platform will email you a sign-in link.')
  process.exit(0)
}

setup().catch(err => {
  console.error('❌ Setup failed:', err.message)
  process.exit(1)
})