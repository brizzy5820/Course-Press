import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore'
import { db } from '../firebase'

/** Every email is compared/stored lower-case and trimmed so one person = one identity. */
export const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

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
    uid, courseId, email: normalizeEmail(email), source, grantedAt: serverTimestamp(),
  })
}

// ---------- Progress ----------

function progressId(uid, courseId) { return `${uid}_${courseId}` }

export async function getProgress(uid, courseId) {
  const snap = await getDoc(doc(db, 'progress', progressId(uid, courseId)))
  return snap.exists() ? snap.data() : { completedLessonIds: [], watchTime: {} }
}

/**
 * Record how many seconds the user has watched for a specific lesson.
 * Uses a debounced write pattern on the client; this is the server-side
 * commit. `watchTime` is a map of lessonId -> seconds watched (integer).
 */
export async function updateLessonWatchTime(uid, courseId, lessonId, secondsWatched) {
  const ref = doc(db, 'progress', progressId(uid, courseId))
  const snap = await getDoc(ref)
  const existing = snap.exists() ? snap.data() : { completedLessonIds: [], watchTime: {} }
  const watchTime = { ...(existing.watchTime || {}), [lessonId]: Math.round(secondsWatched) }
  if (!snap.exists()) {
    await setDoc(ref, { uid, courseId, completedLessonIds: [], watchTime, updatedAt: serverTimestamp() })
  } else {
    await updateDoc(ref, { watchTime, updatedAt: serverTimestamp() })
  }
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
    name, email: normalizeEmail(email), courseId, amount, reference,
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

/**
 * Merge duplicate profiles that share one email into a single identity.
 * Every enrollment and progress doc is moved to primaryUid (keeping the
 * furthest progress), then the duplicate profiles are flagged as removed so
 * they never show up as a second person again.
 */
export async function mergeUserIdentity(primaryUid, duplicateUids = []) {
  for (const uid of duplicateUids) {
    if (!uid || uid === primaryUid) continue

    // Move enrollments (idempotent — re-granted under the primary uid).
    const enr = await getDocs(query(collection(db, 'enrollments'), where('uid', '==', uid)))
    for (const d of enr.docs) {
      const { courseId, email, source } = d.data()
      if (courseId) await grantEnrollment({ uid: primaryUid, courseId, email, source })
      await deleteDoc(d.ref)
    }

    // Merge progress — union completed lessons into the primary's doc.
    const prog = await getDocs(query(collection(db, 'progress'), where('uid', '==', uid)))
    for (const d of prog.docs) {
      const { courseId, completedLessonIds } = d.data()
      if (courseId) {
        const ref = doc(db, 'progress', progressId(primaryUid, courseId))
        const snap = await getDoc(ref)
        const ids  = completedLessonIds || []
        if (snap.exists()) {
          if (ids.length) await updateDoc(ref, { completedLessonIds: arrayUnion(...ids), updatedAt: serverTimestamp() })
        } else {
          await setDoc(ref, { uid: primaryUid, courseId, completedLessonIds: ids, updatedAt: serverTimestamp() })
        }
      }
      await deleteDoc(d.ref)
    }

    // Retire the duplicate profile.
    await updateDoc(doc(db, 'users', uid), { removed: true, role: 'student', removedAt: serverTimestamp() })
  }
}

// ============================================================
// SUB-ADMIN SYSTEM & COURSE REVIEW WORKFLOW
// ============================================================

// Main admin email(s) - hardcoded, only these can create sub-admins
export const MAIN_ADMIN_EMAILS = ['admin@coursepress.com'] // Update with actual main admin email(s)

export function isMainAdmin(email) {
  return MAIN_ADMIN_EMAILS.includes(normalizeEmail(email))
}

/**
 * Create a sub-admin account. Only main admins can call this.
 * Sub-admins have role='admin' but adminLevel='sub' and cannot create other admins.
 */
export async function createSubAdmin({ email, name, createdByUid, managedCourseIds = [] }) {
  const cleanEmail = normalizeEmail(email)
  
  // Verify caller is main admin
  const callerSnap = await getDoc(doc(db, 'users', createdByUid))
  if (!callerSnap.exists() || !isMainAdmin(callerSnap.data().email)) {
    throw new Error('Only main admins can create sub-admins')
  }

  // Check if user already exists
  const existingSnap = await getDoc(doc(db, 'users', cleanEmail))
  if (existingSnap.exists()) {
    throw new Error('User with this email already exists')
  }

  // Create user profile with sub-admin role
  await setDoc(doc(db, 'users', cleanEmail), {
    uid: cleanEmail,
    name: name || '',
    email: cleanEmail,
    role: 'admin',
    adminLevel: 'sub',
    createdBy: createdByUid,
    managedCourses: managedCourseIds || [],
    createdAt: serverTimestamp(),
  })

  return cleanEmail
}

/**
 * Assign courses to a sub-admin. Only main admins can call this.
 */
export async function assignCoursesToSubAdmin(subAdminEmail, courseIds, createdByUid) {
  const cleanEmail = normalizeEmail(subAdminEmail)
  
  // Verify caller is main admin
  const callerSnap = await getDoc(doc(db, 'users', createdByUid))
  if (!callerSnap.exists() || !isMainAdmin(callerSnap.data().email)) {
    throw new Error('Only main admins can assign courses to sub-admins')
  }

  // Verify sub-admin exists and is a sub-admin
  const subAdminSnap = await getDoc(doc(db, 'users', cleanEmail))
  if (!subAdminSnap.exists()) {
    throw new Error('Sub-admin not found')
  }
  const subAdminData = subAdminSnap.data()
  if (subAdminData.adminLevel !== 'sub') {
    throw new Error('User is not a sub-admin')
  }

  // Update managed courses
  await updateDoc(doc(db, 'users', cleanEmail), {
    managedCourses: arrayUnion(...courseIds)
  })

  return true
}

/**
 * Remove course assignment from sub-admin. Only main admins can call this.
 */
export async function removeCourseFromSubAdmin(subAdminEmail, courseId, createdByUid) {
  const cleanEmail = normalizeEmail(subAdminEmail)
  
  // Verify caller is main admin
  const callerSnap = await getDoc(doc(db, 'users', createdByUid))
  if (!callerSnap.exists() || !isMainAdmin(callerSnap.data().email)) {
    throw new Error('Only main admins can manage sub-admin course assignments')
  }

  await updateDoc(doc(db, 'users', cleanEmail), {
    managedCourses: arrayRemove(courseId)
  })

  return true
}

/**
 * Get all sub-admins created by a main admin
 */
export async function listSubAdmins(createdByUid) {
  const q = query(
    collection(db, 'users'),
    where('adminLevel', '==', 'sub'),
    where('createdBy', '==', createdByUid)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }))
}

/**
 * Get courses managed by a sub-admin
 */
export async function getManagedCourses(subAdminUid) {
  const snap = await getDoc(doc(db, 'users', subAdminUid))
  if (!snap.exists()) return []
  const data = snap.data()
  const courseIds = data.managedCourses || []
  if (courseIds.length === 0) return []
  
  const courses = await Promise.all(
    courseIds.map(id => getCourse(id))
  )
  return courses.filter(Boolean)
}

/**
 * Create a course as a sub-admin - goes to pending review
 */
export async function createCourseForReview({ 
  title, subtitle, description, coverImage, price, currency, curriculum, createdByUid 
}) {
  const callerSnap = await getDoc(doc(db, 'users', createdByUid))
  if (!callerSnap.exists()) throw new Error('User not found')
  
  const callerData = callerSnap.data()
  const isMain = isMainAdmin(callerData.email)
  const isSub = callerData.adminLevel === 'sub'

  if (!isMain && !isSub) {
    throw new Error('Only admins can create courses')
  }

  const ref = doc(collection(db, 'courses'))
  await setDoc(ref, {
    title: title || 'Untitled course',
    subtitle: subtitle || '',
    description: description || '',
    coverImage: coverImage || '',
    price: price || 0,
    currency: currency || 'NGN',
    published: false,
    status: isSub ? 'pending_review' : 'draft', // Sub-admin courses go to pending review
    curriculum: curriculum || [],
    createdBy: createdByUid,
    createdAt: serverTimestamp(),
  })

  // If sub-admin, assign the course to them
  if (isSub) {
    await updateDoc(doc(db, 'users', createdByUid), {
      managedCourses: arrayUnion(ref.id)
    })
  }

  return ref.id
}

/**
 * Update course - sub-admins can only update their managed courses
 */
export async function updateCourseWithAuth(courseId, patch, updatedByUid) {
  const callerSnap = await getDoc(doc(db, 'users', updatedByUid))
  if (!callerSnap.exists()) throw new Error('User not found')
  
  const callerData = callerSnap.data()
  const isMain = isMainAdmin(callerData.email)
  const isSub = callerData.adminLevel === 'sub'

  if (!isMain && !isSub) {
    throw new Error('Only admins can update courses')
  }

  // Sub-admins can only update their managed courses
  if (isSub) {
    const managedCourses = callerData.managedCourses || []
    if (!managedCourses.includes(courseId)) {
      throw new Error('You can only update courses assigned to you')
    }
  }

  await updateDoc(doc(db, 'courses', courseId), patch)
}

/**
 * Submit course for review (sub-admin action)
 */
export async function submitCourseForReview(courseId, submittedByUid) {
  const callerSnap = await getDoc(doc(db, 'users', submittedByUid))
  if (!callerSnap.exists()) throw new Error('User not found')
  
  const callerData = callerSnap.data()
  const isSub = callerData.adminLevel === 'sub'

  if (!isSub) {
    throw new Error('Only sub-admins can submit courses for review')
  }

  const managedCourses = callerData.managedCourses || []
  if (!managedCourses.includes(courseId)) {
    throw new Error('You can only submit courses assigned to you')
  }

  await updateDoc(doc(db, 'courses', courseId), {
    status: 'pending_review',
    submittedAt: serverTimestamp(),
  })
}

/**
 * Main admin reviews a course - approve or reject
 */
export async function reviewCourse(courseId, { approved, feedback, reviewedByUid }) {
  const reviewerSnap = await getDoc(doc(db, 'users', reviewedByUid))
  if (!reviewerSnap.exists()) throw new Error('Reviewer not found')
  
  const reviewerData = reviewerSnap.data()
  if (!isMainAdmin(reviewerData.email)) {
    throw new Error('Only main admins can review courses')
  }

  const newStatus = approved ? 'published' : 'rejected'
  const updateData = {
    status: newStatus,
    reviewedAt: serverTimestamp(),
    reviewedBy: reviewedByUid,
  }

  if (!approved && feedback) {
    updateData.reviewFeedback = feedback
  }

  if (approved) {
    updateData.published = true
  }

  await updateDoc(doc(db, 'courses', courseId), updateData)

  // If approved, ensure the course is assigned to the original creator
  if (approved) {
    const courseSnap = await getDoc(doc(db, 'courses', courseId))
    if (courseSnap.exists()) {
      const courseData = courseSnap.data()
      if (courseData.createdBy && courseData.createdBy !== reviewedByUid) {
        await updateDoc(doc(db, 'users', courseData.createdBy), {
          managedCourses: arrayUnion(courseId)
        })
      }
    }
  }
}

/**
 * Get courses pending review for main admin
 */
export async function getPendingReviewCourses() {
  const q = query(
    collection(db, 'courses'),
    where('status', '==', 'pending_review')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Get courses by status for admin dashboard
 */
export async function getCoursesByStatus(status) {
  const q = query(
    collection(db, 'courses'),
    where('status', '==', status)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Get all courses created by a specific admin
 */
export async function getCoursesByCreator(creatorUid) {
  const q = query(
    collection(db, 'courses'),
    where('createdBy', '==', creatorUid)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Check if user can manage a course
 */
export async function canManageCourse(userUid, courseId) {
  const userSnap = await getDoc(doc(db, 'users', userUid))
  if (!userSnap.exists()) return false
  
  const userData = userSnap.data()
  const isMain = isMainAdmin(userData.email)
  if (isMain) return true
  
  const isSub = userData.adminLevel === 'sub'
  if (isSub) {
    return (userData.managedCourses || []).includes(courseId)
  }
  
  return false
}
