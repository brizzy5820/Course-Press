import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, arrayUnion, arrayRemove,
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

// Flatten all lessons into a single ordered array with decimal numbering.
// Each lesson gets:
//   moduleIndex  — 1-based position of its module   (e.g. 2)
//   lessonIndex  — 1-based position within module   (e.g. 3)
//   lessonNumber — display string                   (e.g. "2.3")
export function flattenLessons(course) {
  const out = []
  const curriculum = course?.curriculum || []
  for (let mi = 0; mi < curriculum.length; mi++) {
    const mod = curriculum[mi]
    const lessons = mod.lessons || []
    for (let li = 0; li < lessons.length; li++) {
      out.push({
        ...lessons[li],
        moduleId:     mod.id,
        moduleTitle:  mod.title,
        moduleIndex:  mi + 1,
        lessonIndex:  li + 1,
        lessonNumber: `${mi + 1}.${li + 1}`,
      })
    }
  }
  return out
}

// ---------- Users ----------

export async function ensureUserDoc(uid, { name, email, role = 'student' }) {
  const ref  = doc(db, 'users', uid)
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

function enrollmentId(uid, courseId) { return `${uid}_${courseId}` }

export async function isEnrolled(uid, courseId) {
  if (!uid) return false
  const snap = await getDoc(doc(db, 'enrollments', enrollmentId(uid, courseId)))
  return snap.exists()
}

export async function listMyEnrollments(uid) {
  const q    = query(collection(db, 'enrollments'), where('uid', '==', uid))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data())
}

export async function grantEnrollment({ uid, courseId, email, source = 'manual' }) {
  await setDoc(doc(db, 'enrollments', enrollmentId(uid, courseId)), {
    uid, courseId, email, source, grantedAt: serverTimestamp(),
  })
}

// ---------- Progress ----------

function progressId(uid, courseId) { return `${uid}_${courseId}` }

export async function getProgress(uid, courseId) {
  const snap = await getDoc(doc(db, 'progress', progressId(uid, courseId)))
  return snap.exists() ? snap.data() : { completedLessonIds: [] }
}

export async function markLessonComplete(uid, courseId, lessonId, complete = true) {
  const ref  = doc(db, 'progress', progressId(uid, courseId))
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

// ---------- Orders ----------

export async function createPendingOrder({ name, email, courseId, amount, reference }) {
  await setDoc(doc(db, 'orders', reference), {
    name, email, courseId, amount, reference,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
}
// ---------- Admin: users, enrollments, progress ----------

export async function listUsers() {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => !u.removed)
}

export async function listAllEnrollments() {
  const snap = await getDocs(collection(db, 'enrollments'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function listAllProgress() {
  const snap = await getDocs(collection(db, 'progress'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function listPendingEnrollments() {
  const snap = await getDocs(collection(db, 'pendingEnrollments'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function revokeEnrollment(uid, courseId) {
  await deleteDoc(doc(db, 'enrollments', enrollmentId(uid, courseId)))
}

export async function cancelPendingEnrollment(id) {
  await deleteDoc(doc(db, 'pendingEnrollments', id))
}

/** Move a student from one course to another (keeps nothing from the old course). */
export async function reassignEnrollment({ uid, email, fromCourseId, toCourseId }) {
  if (fromCourseId === toCourseId) return
  await grantEnrollment({ uid, courseId: toCourseId, email, source: 'admin-reassign' })
  if (fromCourseId) await revokeEnrollment(uid, fromCourseId)
}

export async function resetProgress(uid, courseId) {
  await deleteDoc(doc(db, 'progress', progressId(uid, courseId)))
}

/**
 * Remove a user from the site: deletes their enrollments, progress and pending
 * grants, and flags the profile as removed so they are signed out and blocked.
 * (Deleting the Firebase Auth login itself requires the Admin SDK / console.)
 */
export async function removeUser(user) {
  const [enr, prog, pend] = await Promise.all([
    getDocs(query(collection(db, 'enrollments'), where('uid', '==', user.uid))),
    getDocs(query(collection(db, 'progress'), where('uid', '==', user.uid))),
    user.email ? getDocs(query(collection(db, 'pendingEnrollments'), where('email', '==', user.email))) : { docs: [] },
  ])
  await Promise.all([...enr.docs, ...prog.docs, ...pend.docs].map(d => deleteDoc(d.ref)))
  await updateDoc(doc(db, 'users', user.uid), { removed: true, role: 'student', removedAt: serverTimestamp() })
}

export async function setUserRole(uid, role) {
  await updateDoc(doc(db, 'users', uid), { role })
}
