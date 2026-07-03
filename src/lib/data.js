// src/lib/data.js
//
// Data model
// ----------
// courses/{courseId}
//    title, subtitle, description, coverImage, price, currency, published
//    curriculum: [
//      { id, title,                       // a Module
//        lessons: [
//          { id, title, type: 'video' | 'text',
//            youtubeId,                   // for type === 'video'
//            content,                     // markdown/plain text for type === 'text'
//            resources: [{label, url}],   // optional downloadable files (Storage URLs)
//            durationMin }
//        ]
//      }
//    ]
//
// users/{uid}            -> { name, email, role: 'student' | 'admin', createdAt }
// enrollments/{uid}_{courseId} -> { uid, courseId, email, grantedAt, source: 'paystack' | 'manual' }
// progress/{uid}_{courseId}    -> { uid, courseId, completedLessonIds: string[], updatedAt }
// orders/{reference}      -> { name, email, courseId, amount, status: 'pending'|'paid', createdAt }

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, arrayUnion, arrayRemove, addDoc,
} from 'firebase/firestore'
import { db } from '../firebase'

// ---------- Courses ----------

export async function listCourses({ onlyPublished = true } = {}) {
  const snap = await getDocs(collection(db, 'courses'))
  let courses = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  if (onlyPublished) courses = courses.filter(c => c.published)
  return courses
}

export async function getCourse(courseId) {
  const snap = await getDoc(doc(db, 'courses', courseId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function createCourse(course) {
  const ref = doc(collection(db, 'courses'))
  await setDoc(ref, {
    title: course.title || 'Untitled course',
    subtitle: course.subtitle || '',
    description: course.description || '',
    coverImage: course.coverImage || '',
    price: course.price || 0,
    currency: course.currency || 'NGN',
    published: false,
    curriculum: course.curriculum || [],
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateCourse(courseId, patch) {
  await updateDoc(doc(db, 'courses', courseId), patch)
}

export async function deleteCourse(courseId) {
  await deleteDoc(doc(db, 'courses', courseId))
}

// Helper: total lesson count, flattened lesson list in display order
export function flattenLessons(course) {
  const out = []
  for (const mod of course?.curriculum || []) {
    for (const lesson of mod.lessons || []) {
      out.push({ ...lesson, moduleId: mod.id, moduleTitle: mod.title })
    }
  }
  return out
}

// ---------- Users ----------

export async function ensureUserDoc(uid, { name, email, role = 'student' }) {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, { name, email, role, createdAt: serverTimestamp() })
  }
  return (await getDoc(ref)).data()
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? snap.data() : null
}

// ---------- Enrollments ----------

function enrollmentId(uid, courseId) {
  return `${uid}_${courseId}`
}

export async function isEnrolled(uid, courseId) {
  if (!uid) return false
  const snap = await getDoc(doc(db, 'enrollments', enrollmentId(uid, courseId)))
  return snap.exists()
}

export async function listMyEnrollments(uid) {
  const q = query(collection(db, 'enrollments'), where('uid', '==', uid))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data())
}

// Used by Cloud Functions (admin SDK) too — kept here for reference of shape.
export async function grantEnrollment({ uid, courseId, email, source = 'manual' }) {
  await setDoc(doc(db, 'enrollments', enrollmentId(uid, courseId)), {
    uid, courseId, email, source, grantedAt: serverTimestamp(),
  })
}

// ---------- Progress ----------

function progressId(uid, courseId) {
  return `${uid}_${courseId}`
}

export async function getProgress(uid, courseId) {
  const snap = await getDoc(doc(db, 'progress', progressId(uid, courseId)))
  return snap.exists() ? snap.data() : { completedLessonIds: [] }
}

export async function markLessonComplete(uid, courseId, lessonId, complete = true) {
  const ref = doc(db, 'progress', progressId(uid, courseId))
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      uid, courseId,
      completedLessonIds: complete ? [lessonId] : [],
      updatedAt: serverTimestamp(),
    })
  } else {
    await updateDoc(ref, {
      completedLessonIds: complete ? arrayUnion(lessonId) : arrayRemove(lessonId),
      updatedAt: serverTimestamp(),
    })
  }
}

// ---------- Orders (pending checkouts, finalized by Cloud Functions) ----------

export async function createPendingOrder({ name, email, courseId, amount, reference }) {
  await setDoc(doc(db, 'orders', reference), {
    name, email, courseId, amount, reference,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
}
