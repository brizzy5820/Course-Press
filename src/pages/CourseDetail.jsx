import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowDown } from 'lucide-react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import {
  PlayCircle, FileText, Lock, Clock,
  CheckCircle2, Check, ArrowRight, Loader,
  ChevronDown, ChevronRight, ExternalLink,
} from 'lucide-react'
import { auth, db } from '../firebase'
import { getCourse, isEnrolled, createPendingOrder, getProgress } from '../lib/data'
import Sidebar from '../components/Sidebar'
import {
  accountExists,
  writeProfileAndEnrollment,
  activatePendingEnrollments,
} from '../lib/access'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import VideoPlayer from '../components/VideoPlayer'
import TopNav from '../components/TopNav'
import Preloader from '../components/Preloader'

function truncateHalf(text = '') {
  if (!text) return ''
  const half = Math.ceil(text.length / 2)
  return text.length > half ? text.slice(0, half).trimEnd() + '…' : text
}

function SoundwaveBackground() {
  const bars = Array.from({ length: 72 })
  return (
    <div className="absolute inset-x-0 top-0 h-[560px] overflow-hidden pointer-events-none">
      <svg
        className="w-full h-full"
        viewBox="0 0 1440 560"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="soundwaveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
             <stop offset="0%" stopColor="#00000000" />
            <stop offset="55%" stopColor="#3F3F4600" />
            <stop offset="100%" stopColor="#A1A1AA" />
           
          </linearGradient>
        </defs>
        {bars.map((_, i) => {
          const x = (i / bars.length) * 1440
          const h =
            50 +
            Math.abs(Math.sin(i * 0.45)) * 220 +
            Math.abs(Math.sin(i * 0.11)) * 90
          const y = Math.max(0, (300 - h) / 2)
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width="8"
              height={h}
              rx="4"
              fill="url(#soundwaveGradient)"
              opacity="0.9"
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#F7F8FA]/70 to-[#F7F8FA]" />
    </div>
  )
}

function CourseBackground({ image, isDark }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {image ? (
        <img
          src={image}
          alt=""
          className=" w-full object-cover opacity-[0.06] dark:opacity-[0.07]"
        />
      ) : (
        <div className="h-full w-full bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.22),_transparent_55%)]" />
      )}
     
   
    </div>
  )
}

export default function CourseDetail() {
  const { courseId } = useParams()
  const navigate     = useNavigate()
  const { user, profile } = useAuth()
  const { theme }    = useTheme()
  const isDark       = theme === 'dark'

  const [course,      setCourse]      = useState(null)
  const [enrolled,    setEnrolled]    = useState(false)
  const [form,        setForm]        = useState({ name: '', email: '', phone: '' })
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState('')
  const [paid,        setPaid]        = useState(false)
  const [completedIds, setCompletedIds] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // accordion state
  const [openModules, setOpenModules] = useState(() => new Set())
  const [openLessons, setOpenLessons] = useState(() => new Set())

  useEffect(() => { getCourse(courseId).then(setCourse) }, [courseId])
  useEffect(() => {
    if (user && courseId) {
      isEnrolled(user.uid, courseId).then(setEnrolled)
      getProgress(user.uid, courseId).then(p => setCompletedIds(p.completedLessonIds || []))
    }
  }, [user, courseId])

  // open the first module by default once the course loads
  useEffect(() => {
    if (course?.curriculum?.length) {
      setOpenModules(new Set([course.curriculum[0].id]))
    }
  }, [course])

  useEffect(() => {
    const scrollKey = `scrollPos-${courseId}`
    const scrollPos = sessionStorage.getItem(scrollKey)
    if (scrollPos && course) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(scrollPos, 10))
        sessionStorage.removeItem(scrollKey)
      }, 50)
    }
  }, [course, courseId])

  if (!course) return <Preloader label="Loading course" />

  function setField(key) {
    return e => setForm(f => ({ ...f, [key]: e.target.value }))
  }

  function toggleModule(id) {
    setOpenModules(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleLesson(id) {
    setOpenLessons(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function goToLesson(lesson) {
    sessionStorage.setItem(`scrollPos-${courseId}`, window.scrollY.toString())
    navigate(`/dashboard/${courseId}?lesson=${lesson.id}`)
  }

  async function handlePay(e) {
    e.preventDefault()
    setError('')
    
    const effectiveEmail = user ? user.email : form.email
    const effectiveName = (user && profile?.name) ? profile.name : form.name
    
    if (!effectiveName || !effectiveEmail) {
      setError('Please fill in all required fields.')
      return
    }
    if (!user && (!form.phone || form.phone.replace(/\D/g, '').length < 6)) {
      setError('Please enter a valid phone number — it will be used to sign in later.')
      return
    }
    setSubmitting(true)
    try {
      const reference = `cp_${courseId}_${Date.now()}`
      await createPendingOrder({
        name: effectiveName, email: effectiveEmail,
        courseId, amount: course.price, reference,
      })
      const handler = window.PaystackPop.setup({
        key:      import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
        email:    effectiveEmail,
        amount:   Math.round(course.price * 100),
        currency: course.currency || 'NGN',
        ref:      reference,
        metadata: { name: effectiveName, courseId },
        callback: async function () {
          try {
            if (user) {
              await writeProfileAndEnrollment({ uid: user.uid, name: effectiveName, email: effectiveEmail, courseId, source: 'paystack' })
              navigate(`/dashboard/${courseId}`, { replace: true })
            } else {
              const exists     = await accountExists(effectiveEmail)
              const cleanPhone = form.phone.replace(/\D/g, '')
              if (!exists) {
                const cred = await createUserWithEmailAndPassword(auth, effectiveEmail, cleanPhone)
                const uid  = cred.user.uid
                await writeProfileAndEnrollment({ uid, name: effectiveName, email: effectiveEmail, courseId, source: 'paystack' })
                await activatePendingEnrollments(uid, effectiveEmail)
                navigate(`/dashboard/${courseId}`, { replace: true })
              } else {
                await setDoc(doc(db, 'pendingEnrollments', `${effectiveEmail}_${courseId}`), {
                  name: effectiveName, email: effectiveEmail, courseId,
                  source: 'paystack', createdAt: serverTimestamp(),
                })
                await setDoc(doc(db, 'orders', reference), { status: 'paid' }, { merge: true })
                setPaid(true)
                setSubmitting(false)
              }
            }
          } catch (err) {
            console.error(err)
            setError('Payment received but access setup failed. Contact support with your email.')
            setSubmitting(false)
          }
        },
        onClose: function () {
          setSubmitting(false)
        },
      })
      handler.openIframe()
    } catch (err) {
      console.error(err)
      setError('Failed to initiate payment. Please try again.')
      setSubmitting(false)
    }
  }

  const totalLessons = (course.curriculum || []).reduce((s, m) => s + (m.lessons?.length || 0), 0)

  return (
    <div className={`min-h-screen relative overflow-x-hidden transition-colors duration-200 ${isDark ? 'bg-neutral-950' : 'bg-[#F7F8FA]'}`}>
      {/* <CourseBackground image={course.coverImage} isDark={isDark} /> */}

      <div className="relative z-10">
        <div className="hidden lg:block">
          <TopNav maxWidth="max-w-3xl" />
        </div>
        <header className={`hidden fixed  backdrop-blur-sm border-b sticky top-0 z-10 transition-colors duration-200
          ${isDark ? 'bg-neutral-900/90 border-neutral-800' : 'bg-transparent border-zinc-200'}`}>
          <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link to="/" className={`font-bold text-[17px] tracking-tight transition
              ${isDark ? 'text-white' : 'text-black'}`}>CoursePress</Link>
            {user ? (
              <Link to="/dashboard" className={`text-sm font-medium transition flex items-center gap-1.5
                ${isDark ? 'text-neutral-400 hover:text-white' : 'text-amber-600 hover:text-black'}`}>
                My library <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <Link
                to="/login"
                className={`text-sm font-semibold transition ${isDark ? 'text-neutral-300 hover:text-white' : 'text-black hover:text-black'}`}
              >
                Sign in
              </Link>
            )}
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 mt-6 py-12">

          {/* Hero */}
          <p className={`font-mono text-xs uppercase tracking-[0.2em] mb-3 ${isDark ? 'text-neutral-500' : 'text-amber-600'}`}>Course</p>
          <h1 className={`font-sans text-2xl lg:text-4xl font-semibold leading-tight ${isDark ? 'text-white' : 'text-black'}`}>{course.title}</h1>
          <p className={`text-lg mt-3 leading-relaxed ${isDark ? 'text-neutral-400' : 'text-zinc-600'}`}>{course.subtitle}</p>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-2 mt-6">
            <StatPill icon={<FileText className="h-3.5 w-3.5" />} label={`${totalLessons} lessons`} isDark={isDark} />
            {/* <StatPill icon={<Clock className="h-3.5 w-3.5" />} label="Self-paced" isDark={isDark} /> */}
            <StatPill icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Lifetime access" isDark={isDark} />
          </div>
   <a href="#checkout"
  className= {`font-sans text-xl font-semibold mt-5 flex items-cente gap-2 mb-4 ${
    isDark ? 'text-white' : 'text-black'
  }`}
>
  What's inside <div className="flex justify-center r mt-2">
  <div className="flex flex-col items-center gap-[3px]">

    <ArrowDown 
      className={`h-4 w-4 animate-[digitalArrow_1.5s_ease-in-out_infinite] ${
        isDark
          ? 'text-amber-300 drop-shadow-[0_0_5px_rgba(251,191,36,0.4)]'
          : 'text-black drop-shadow-[0_0_5px_rgba(0,0,0,0.4)]'
      }`}
    />
  </div>
</div>
</a>
          {/* Cover */}
          {course.coverImage && (
            <img
              src={course.coverImage}
              alt={course.title}
              className="w-full rounded-2xl mt-4 mb-3 aspect-[16/9] object-cover shadow-sm"
            />
          )}

          {/* Description */}
          {course.description && (
            <div className={`prose-reader mt-8 whitespace-pre-line leading-[1.85] text-[1.02rem] ${isDark ? 'text-neutral-300' : 'text-black/80'}`}>
              {course.description}
            </div>
          )}

          {/* Curriculum */}
       

<div className="space-y-5">
  {(course.curriculum || []).map((mod, mi) => {
    const modOpen = openModules.has(mod.id)
    const lessons = mod.lessons || []
    const isModuleComplete = lessons.length > 0 && lessons.every(lesson => completedIds.includes(lesson.id))

    return (
      <section
        key={mod.id}
        className={`overflow-hidden rounded-2xl border ${
          isDark
            ? 'border-neutral-800 bg-neutral-950'
            : 'border-zinc-200 bg-white'
        }`}
      >
        {/* =========================
            MODULE HEADER
        ========================== */}
        <button
          type="button"
          onClick={() => toggleModule(mod.id)}
          className={`w-full px-5 py-4 text-left dark:bg-neutral-900 transition ${
            isDark
              ? 'hover:bg-neutral-500'
              : 'hover:bg-zinc-50'
          }`}
        >
          <div className="flex items-start gap-3">
            {/* Module arrow */}
            <div className="pt-1 shrink-0">
              {modOpen ? (
                <ChevronDown
                  className={`h-4 w-4 ${
                    isDark
                      ? 'text-neutral-400'
                      : 'text-zinc-500'
                  }`}
                />
              ) : (
                <ChevronRight
                  className={`h-4 w-4 ${
                    isDark
                      ? 'text-neutral-400'
                      : 'text-zinc-500'
                  }`}
                />
              )}
            </div>

            {/* Module content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`font-mono text-[13px] uppercase tracking-[0.14em] font-medium ${
                    isDark
                      ? 'text-amber-300/70'
                      : 'text-amber-700'
                  }`}
                >
                  Module {mi + 1}
                </span>

                <span
                  className={
                    isDark
                      ? 'text-neutral-700'
                      : 'text-zinc-300'
                  }
                >
                  ·
                </span>

                <span
                  className={`font-mono text-[10px] ${
                    isDark
                      ? 'text-neutral-500'
                      : 'text-zinc-400'
                  }`}
                >
                  {lessons.length}{' '}
                  {lessons.length === 1 ? 'lesson' : 'lessons'}
                </span>

                {isModuleComplete && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                )}
              </div>

              {/* Module title */}
              <h3
                className={`text-sm font-semibold leading-snug ${
                  isModuleComplete
                    ? isDark
                      ? 'text-emerald-400 line-through decoration-2 decoration-emerald-500'
                      : 'text-emerald-600 line-through decoration-2 decoration-emerald-500'
                    : isDark ? 'text-white' : 'text-zinc-900'
                }`}
              >
                {mod.title}
              </h3>
            </div>
          </div>
        </button>

        {/* =========================
            LESSONS / SUBMODULES
        ========================== */}
        {modOpen && (
          <div
            className={`border-t   ${
              isDark
                ? 'border-neutral-800'
                : 'border-zinc-200'
            }`}
          >
            <div className="divide-y divide-transparent">
              {lessons.map((lesson, li) => {
                const isVideo = lesson.type === 'video'
                const isText = lesson.type === 'text'
                const isLessonComplete = completedIds.includes(lesson.id)

                const expandable =
                  enrolled && (isVideo || isText)

                const lessonOpen =
                  openLessons.has(lesson.id)

                const lessonNumber = `${mi + 1}.${li + 1}`

                return (
                  <div key={lesson.id}>
                    {/* =========================
                        SUBMODULE ROW
                    ========================== */}
                    <div
                      className={`px-5 py-3 transition border-b border-gray-200 dark:border-neutral-800 ${
                        expandable
                          ? isDark
                            ? 'hover:bg-neutral-900'
                            : 'hover:bg-zinc-50'
                          : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Arrow — far left */}
                        <button
                          type="button"
                          disabled={!expandable}
                          onClick={() =>
                            expandable &&
                            toggleLesson(lesson.id)
                          }
                          className={`mt-1.5 w-4 shrink-0 ${
                            expandable
                              ? 'cursor-pointer'
                              : 'cursor-default'
                          }`}
                        >
                          {expandable ? (
                            lessonOpen ? (
                              <ChevronDown
                                className={`h-3.5 w-3.5 ${
                                  isDark
                                    ? 'text-neutral-400'
                                    : 'text-zinc-500'
                                }`}
                              />
                            ) : (
                              <ChevronRight
                                className={`h-3.5 w-3.5 ${
                                  isDark
                                    ? 'text-neutral-400'
                                    : 'text-zinc-500'
                                }`}
                              />
                            )
                          ) : (
                            <span className="block w-3.5" />
                          )}
                        </button>

                        {/* Submodule content */}
                        <button
                          type="button"
                          onClick={() => {
                            if (expandable) {
                              toggleLesson(lesson.id)
                            } else {
                              goToLesson(lesson)
                            }
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          {/* Number + media icon + completion */}
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono text-[10px] font-medium ${
                                isDark
                                  ? 'text-amber-300/80'
                                  : 'text-amber-700'
                              }`}
                            >
                              {lessonNumber}
                            </span>

                            {isVideo ? (
                              <PlayCircle
                                className={`h-3.5 w-3.5 ${
                                  isDark
                                    ? 'text-neutral-300'
                                    : 'text-zinc-600'
                                }`}
                              />
                            ) : (
                              <FileText
                                className={`h-3.5 w-3.5 ${
                                  isDark
                                    ? 'text-neutral-300'
                                    : 'text-zinc-600'
                                }`}
                              />
                            )}

                            <span
                              className={`text-[10px] uppercase tracking-wider ${
                                isDark
                                  ? 'text-neutral-500'
                                  : 'text-zinc-400'
                              }`}
                            >
                              {isVideo
                                ? 'Video'
                                : 'Reading'}
                            </span>

                            {isLessonComplete && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            )}
                          </div>

                          {/* Submodule title */}
                          <h4
                            className={`mt-1 text-sm font-semibold leading-snug break-words ${
                              isLessonComplete
                                ? isDark
                                  ? 'text-emerald-400 line-through decoration-2 decoration-emerald-500'
                                  : 'text-emerald-600 line-through decoration-2 decoration-emerald-500'
                                : isDark ? 'text-neutral-100' : 'text-zinc-900'
                            }`}
                          >
                            {lesson.title}
                          </h4>

                          {/* Metadata */}
                          <div
                            className={`mt-1 flex items-center gap-2 font-mono text-[10px] ${
                              isDark
                                ? 'text-neutral-500'
                                : 'text-zinc-400'
                            }`}
                          >
                            {lesson.topicCount != null && (
                              <span>
                                {lesson.topicCount}{' '}
                                {lesson.topicCount === 1
                                  ? 'Topic'
                                  : 'Topics'}
                              </span>
                            )}

                            {lesson.durationMin && (
                              <>
                                <span>·</span>
                                <span>
                                  {lesson.durationMin}m
                                </span>
                              </>
                            )}
                          </div>
                        </button>

                        {/* Completion / lock */}
                        <div className="shrink-0 pt-1">
                          {!enrolled ? (
                            <Lock
                              className={`h-3.5 w-3.5 ${
                                isDark
                                  ? 'text-neutral-600'
                                  : 'text-zinc-400'
                              }`}
                            />
                          ) : isLessonComplete ? (
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded-full ${
                                isDark
                                  ? 'bg-emerald-500 text-neutral-950'
                                  : 'bg-emerald-600 text-white'
                              }`}
                            >
                              <Check className="h-3 w-3" />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* =========================
                        EXPANDED CONTENT
                    ========================== */}
                    {expandable && lessonOpen && (
                      <div
                        className={`px-2 pb-4 ${
                          isDark
                            ? 'bg-neutral-950'
                            : 'bg-white'
                        }`}
                      >
                        {/* FULL-WIDTH VIDEO / CONTENT */}
                        {isVideo && (
                          <div className="w-full">
                            {lesson.videoUrl ? (
                              <video
                                controls
                                preload="metadata"
                                poster={
                                  lesson.thumbnail ||
                                  undefined
                                }
                                className={`block w-full aspect-video rounded-lg ${
                                  isDark
                                    ? 'bg-neutral-950'
                                    : 'bg-black'
                                }`}
                              >
                                <source
                                  src={lesson.videoUrl}
                                />
                                Your browser doesn't support
                                embedded video.
                              </video>
                            ) : lesson.embedUrl ? (
                              <iframe
                                src={lesson.embedUrl}
                                className="block w-full aspect-video rounded-lg border-0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            ) : lesson.youtubeId ? (
                              <div className="w-full">
                                <VideoPlayer
                                  youtubeId={lesson.youtubeId}
                                  onEnded={() => {}}
                                />
                              </div>
                            ) : (
                              <div
                                className={`w-full aspect-video rounded-lg flex flex-col items-center justify-center gap-2 ${
                                  isDark
                                    ? 'bg-neutral-800'
                                    : 'bg-zinc-900'
                                }`}
                              >
                                <PlayCircle className="h-9 w-9 text-white/60" />

                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                                  Coming soon
                                </p>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                goToLesson(lesson)
                              }
                              className={`mt-3 px-2 inline-flex items-center gap-1.5 text-xs font-medium transition ${
                                isDark
                                  ? 'text-neutral-400 hover:text-white'
                                  : 'text-zinc-600 hover:text-black'
                              }`}
                            >
                              Open full lesson
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          </div>
                        )}

                        {/* TEXT LESSON */}
                        {isText && lesson.content && (
                          <div className="w-full">
                            <p
                              className={`text-xs leading-relaxed ${
                                isDark
                                  ? 'text-neutral-400'
                                  : 'text-zinc-600'
                              }`}
                            >
                              {truncateHalf(
                                lesson.content
                              )}
                            </p>

                            <button
                              type="button"
                              onClick={() =>
                                goToLesson(lesson)
                              }
                              className={`mt-2 inline-flex items-center gap-1.5 text-xs font-medium transition ${
                                isDark
                                  ? 'text-neutral-400 hover:text-white'
                                  : 'text-zinc-600 hover:text-black'
                              }`}
                            >
                              Open full lesson
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>
    )
  })}
</div>

          {/* CTA */}
          <div id="checkout" className={`mt-14 border-t pt-10 ${isDark ? 'border-neutral-800' : 'border-amber-200'}`}>
            {enrolled ? (
              <button
              id='curriculum'
                onClick={() => navigate(`/dashboard/${courseId}`)}
                className={`w-full rounded-xl py-4 font-semibold transition flex items-center justify-center gap-2
                  ${isDark ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-amber-600 text-white hover:bg-amber-700'}`}
              >
                Open course <ArrowRight className="h-4 w-4" />
              </button>

            ) : paid ? (
              <div className={`border rounded-2xl p-7 text-center space-y-3 ${isDark ? 'bg-neutral-900 border-neutral-700' : 'bg-zinc-100 border-zinc-300'}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${isDark ? 'bg-neutral-800' : 'bg-zinc-200'}`}>
                  <CheckCircle2 className={`h-6 w-6 ${isDark ? 'text-amber-500' : 'text-black'}`} />
                </div>
                <p className={`font-display text-xl font-semibold ${isDark ? 'text-white' : 'text-black'}`}>Payment received!</p>
                <p className={`text-sm leading-relaxed ${isDark ? 'text-neutral-400' : 'text-zinc-600'}`}>
                  Your access is ready. Sign in with{' '}
                  <strong className={isDark ? 'text-white' : 'text-black'}>{form.email}</strong> and your phone number.
                </p>
                <button 
                  onClick={() => navigate(`/login?redirect=${courseId}`)}
                  className={`inline-flex items-center gap-2 mt-2 rounded-lg px-6 py-2.5 font-semibold transition text-sm
                    ${isDark ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-amber-600 text-white hover:bg-amber-700'}`}
                >
                  Sign in now <ArrowRight className="h-4 w-4" />
                </button>
              </div>

            ) : (
              <div className={`border rounded-2xl p-6 shadow-sm ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-zinc-200'}`}>
                <div className="flex items-baseline justify-between mb-6">
                  <h3 className={`font-display text-xl font-semibold ${isDark ? 'text-white' : 'text-black'}`}>Get instant access</h3>
                  <span className={`font-bold text-2xl ${isDark ? 'text-white' : 'text-black'}`}>
                    {course.price ? `₦${Number(course.price).toLocaleString()}` : 'Free'}
                  </span>
                </div>

                <form onSubmit={handlePay} className="space-y-3">
                  {!(user && profile?.name) && (
                    <input
                      required
                      placeholder="Full name"
                      value={form.name}
                      onChange={setField('name')}
                      className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 transition
                        ${isDark ? 'bg-neutral-800 border-neutral-700 text-white focus:border-amber-500 focus:ring-amber-500/20' : 'bg-white border-zinc-200 text-black focus:border-black focus:ring-black/10'}`}
                    />
                  )}
                  {!user && (
                    <>
                      <input
                        required
                        type="email"
                        placeholder="Email address"
                        value={form.email}
                        onChange={setField('email')}
                        className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 transition
                          ${isDark ? 'bg-neutral-800 border-neutral-700 text-white focus:border-amber-500 focus:ring-amber-500/20' : 'bg-white border-zinc-200 text-black focus:border-black focus:ring-black/10'}`}
                      />
                      <div>
                        <input
                          required
                          type="tel"
                          placeholder="Phone number (e.g. 08012345678)"
                          value={form.phone}
                          onChange={setField('phone')}
                          className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 transition
                            ${isDark ? 'bg-neutral-800 border-neutral-700 text-white focus:border-amber-500 focus:ring-amber-500/20' : 'bg-white border-zinc-200 text-black focus:border-black focus:ring-black/10'}`}
                        />
                        <p className={`text-xs mt-2 ml-1 flex items-center gap-1.5 ${isDark ? 'text-neutral-500' : 'text-zinc-500'}`}>
                          <Lock className="h-3 w-3" />
                          Your phone number becomes your sign-in password — remember it.
                        </p>
                      </div>
                    </>
                  )}

                  {error && (
                    <div className={`border rounded-xl px-4 py-3 text-sm ${isDark ? 'bg-neutral-800 border-neutral-700 text-neutral-300' : 'bg-zinc-100 border-zinc-300 text-black'}`}>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className={`w-full rounded-xl py-3.5 font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2 mt-2
                      ${isDark ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-amber-600 text-white hover:bg-amber-700'}`}
                  >
                    {submitting
                      ? <><Loader className="h-4 w-4 animate-spin" /> Opening checkout…</>
                      : 'Pay with card or bank transfer'}
                  </button>

                  <p className={`text-xs text-center pt-1 ${isDark ? 'text-neutral-500' : 'text-zinc-500'}`}>
                    New accounts are opened instantly the moment payment clears.
                  </p>
                </form>
              </div>
            )}
          </div>
        </main>
      </div>

      <Sidebar
        course={course}
        activeLessonId={null}
        completedIds={completedIds}
        onSelect={lesson => {
          setSidebarOpen(false)
          goToLesson(lesson)
        }}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(open => !open)}
        onCollapsedChange={setSidebarCollapsed}
        topLink={{ to: `/dashboard/${courseId}`, label: 'Open course player' }}
        onBack={() => navigate(-1)}
        desktopVisible={false}
      />
    </div>
  )
}

function StatPill({ icon, label, isDark }) {
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium border rounded-full px-3 py-1.5
      ${isDark ? 'text-neutral-400 bg-neutral-800 border-neutral-700' : 'text-white-600 bg-white border-amber-300'}`}>
      {icon} {label}
    </span>
  )
}
