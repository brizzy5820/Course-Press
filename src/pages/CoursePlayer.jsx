import { useEffect, useMemo, useState } from 'react'
import { useParams, Navigate, Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight,
  Download, Moon, Sun, BookOpen, PlayCircle, Loader2,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useToast } from '../contexts/ToastContext'
import {
  getCourse, isEnrolled, getProgress,
  markLessonComplete, flattenLessons, updateLessonWatchTime,
} from '../lib/data'
import Sidebar from '../components/Sidebar'
import VideoPlayer from '../components/VideoPlayer'
import AudioPlayer from '../components/AudioPlayer'
import Preloader from '../components/Preloader'
import CertificateModal, { hasCertificate } from '../components/CertificateModal'
import CertificateLockModal from '../components/CertificateLockModal'

// Render links in plain text
function linkifyToReact(text, keyPrefix = 'link') {
  if (!text) return []
  const str = String(text)
  const parts = str.split(/(https?:\/\/[^\s<>()"]+|www\.[^\s<>()"]+)/gi)
  return parts.filter(Boolean).map((part, i) => {
    const isUrl = /^(https?:\/\/|www\.)/i.test(part)
    if (!isUrl) return <span key={`${keyPrefix}-${i}`}>{part}</span>
    const href = part.startsWith('http') ? part : `https://${part}`
    return (
      <a
        key={`${keyPrefix}-${i}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    )
  })
}

function LinkifiedText({ text, className = '' }) {
  if (!text) return null
  const nodes = linkifyToReact(text, 'lt')
  return <span className={className}>{nodes}</span>
}

export default function CoursePlayer() {
  const { courseId } = useParams()
  const [searchParams] = useSearchParams()
  const lessonIdFromUrl = searchParams.get('lesson')
  
  const { user, profile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const toast = useToast()
  const isDark       = theme === 'dark'

  const [course,       setCourse]       = useState(null)
  const [allowed,      setAllowed]      = useState(null)
  const [completedIds, setCompletedIds] = useState([])
  const [watchTime,    setWatchTime]    = useState({})
  const [activeLesson, setActiveLesson] = useState(null)
  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [certOpen, setCertOpen] = useState(false)
  const [completeBusy, setCompleteBusy] = useState(false)
  const [certLocked, setCertLocked] = useState(false)
  const [audioAutoPlay, setAudioAutoPlay] = useState(false)

  const lessons = useMemo(() => course ? flattenLessons(course) : [], [course])

  useEffect(() => {
    if (!user) return
    isEnrolled(user.uid, courseId).then(setAllowed)
    getCourse(courseId).then(setCourse)
    getProgress(user.uid, courseId).then(p => {
      setCompletedIds(p.completedLessonIds)
      setWatchTime(p.watchTime || {})
    })
  }, [user, courseId])

  useEffect(() => {
    if (lessons.length && !activeLesson) {
      if (lessonIdFromUrl) {
        const found = lessons.find(l => l.id === lessonIdFromUrl)
        if (found) {
          setActiveLesson(found)
          return
        }
      }
      setActiveLesson(lessons[0])
    }
  }, [lessons])

  // Reset auto-play flag when lesson changes away from audio
  useEffect(() => {
    if (activeLesson?.type !== 'audio') {
      setAudioAutoPlay(false)
    }
  }, [activeLesson?.type])

  if (allowed === false) return <Navigate to={`/courses/${courseId}`} replace />
  if (!course || allowed === null) return <Preloader label="Loading lesson" />

  async function toggleComplete() {
    const done = !completedIds.includes(activeLesson.id)
    await markLessonComplete(user.uid, courseId, activeLesson.id, done)
    setCompletedIds(ids =>
      done ? [...ids, activeLesson.id] : ids.filter(i => i !== activeLesson.id)
    )
  }

  // Certificate prompt from the sidebar: only unlocked once every lesson is done.
  const allComplete = lessons.length > 0 && lessons.every(l => completedIds.includes(l.id))
  const hasLessons  = lessons.length > 0

  function requestCertificate() {
    if (allComplete) { setCertOpen(true); return }
    setCertLocked(true)
  }

  // "Mark complete" spins until Firestore confirms the write. When the module
  // has no uploaded course content there's nothing to do — no spinner, just a
  // straight message.
  async function handleCompleteClick() {
    if (completeBusy) return
    if (!hasLessons || !activeHasContent) {
      toast('No course content yet — this module has nothing to complete.', 'info')
      return
    }
    setCompleteBusy(true)
    try {
      await toggleComplete()
    } finally {
      setCompleteBusy(false)
    }
  }

  // Watch time tracking for media lessons
  function handleMediaProgress({ watched, duration, percent, lessonId }) {
    setWatchTime(prev => ({ ...prev, [activeLesson.id]: watched }))
  }

  // Called when 50% threshold is reached — auto-mark complete
  async function handleAutoComplete() {
    if (!activeLesson || completedIds.includes(activeLesson.id)) return
    const done = true
    await markLessonComplete(user.uid, courseId, activeLesson.id, done)
    setCompletedIds(ids => [...ids, activeLesson.id])
    toast('Lesson auto-completed — you watched/listened to 50%!', 'success')
  }

const lessonIdx  = lessons.findIndex(l => l.id === activeLesson?.id)
   
  const hasPrev    = lessonIdx > 0
  const hasNext    = lessonIdx < lessons.length - 1
  const isDoneLesson = completedIds.includes(activeLesson?.id)
  const isDarkText   = activeLesson?.type === 'text' && isDark

  // For audio/video watch time tracking
  const isMediaLesson = activeLesson?.type === 'video' || activeLesson?.type === 'audio'
  const activeHasContent = !!(activeLesson?.youtubeId || activeLesson?.audioUrl || activeLesson?.content)

  function goTo(idx) {
    if (idx >= 0 && idx < lessons.length) {
      const nextLesson = lessons[idx]
      setActiveLesson(nextLesson)
      // Auto-play audio when navigating to an audio lesson
      setAudioAutoPlay(nextLesson.type === 'audio')
    }
    setSidebarOpen(false)
  }

  // Determine background/text based on global theme (text lessons also have local toggle)
  const bgClass   = isDarkText ? 'bg-slate-950 text-slate-100' : isDark ? 'bg-neutral-950 text-neutral-100' : 'bg-white text-slate-900'

  return (
    <div className={`min-h-screen  ${isDark ? 'bg-neutral-950' : 'bg-white'}`}>
      <main className={`min-w-0 overflow-auto pt-14 lg:pt-0 transition-all duration-300 ${sidebarCollapsed ? "lg:ml-24" : "lg:ml-[288px]"}`}>
        <div className={`min-h-screen transition-colors duration-200 ${bgClass}`}>
          <div className="max-w-5xl mx-auto px-3 sm:px-8 py-8 lg:py-12">

            {/* Lesson header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium">Module</span>
                <span className="font-mono text-xs font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">
                  {activeLesson?.lessonNumber}
                </span>
                <span className={`text-xs font-medium flex items-center gap-1
                  ${isDarkText ? 'text-slate-500' : isDark ? 'text-neutral-500' : 'text-slate-400'}`}>
{activeLesson?.type === 'video'
                      ? <><PlayCircle className="h-3 w-3" /> Video</>
                      : activeLesson?.type === 'audio'
                        ? <><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 12c0 1.657-1.343 3-3 3H6a3 3 0 01-3-3V6a3 3 0 013-3h10a3 3 0 013 3v6z"/></svg> Audio</>
                        : <><BookOpen className="h-3 w-3" /> Reading</>}
                </span>
                {activeLesson?.durationMin && (
                  <span className={`text-xs font-mono ${isDarkText ? 'text-slate-600' : isDark ? 'text-neutral-600' : 'text-slate-400'}`}>
                    · {activeLesson.durationMin} min
                  </span>
                )}
              </div>
              <h2 className={`text-xl font-bold leading-tight tracking-tight
                ${isDoneLesson
                  ? isDarkText
                    ? 'text-emerald-400 line-through decoration-2 decoration-emerald-500'
                    : isDark
                      ? 'text-emerald-400 line-through decoration-2 decoration-emerald-500'
                      : 'text-emerald-600 line-through decoration-2 decoration-emerald-500'
                  : isDarkText ? 'text-white' : isDark ? 'text-white' : 'text-slate-900'}`}>
                <LinkifiedText text={activeLesson?.title} />
              </h2>
            </div>

            {/* Content */}
            <div  className="mt-10">
              {activeLesson?.type === 'video' ? (
                <VideoPlayer
                  youtubeId={activeLesson.youtubeId}
                  lessonId={activeLesson.id}
                  userId={user.uid}
                  courseId={courseId}
                  initialWatchTime={watchTime[activeLesson.id] || 0}
                  videoDurationMin={activeLesson.durationMin || 0}
                  updateWatchTime={updateLessonWatchTime}
                  onWatchProgress={handleMediaProgress}
                  onAutoComplete={handleAutoComplete}
                  onEnded={() => {}}
                />
              ) : activeLesson?.type === 'audio' ? (
                <AudioPlayer
                  src={activeLesson.audioUrl}
                  title={activeLesson.title}
                  onEnded={() => {}}
                  onTimeUpdate={(current, dur) => {}}
                  autoPlay={audioAutoPlay}
                />
              ) : (
                <div className="flex justify-end mb-5">
                  <button
                    onClick={toggleTheme}
                    className={`inline-flex items-center gap-2 text-xs font-medium rounded-full px-3.5 py-1.5 border transition
                      ${isDarkText
                        ? 'border-white/10 text-slate-400 hover:text-slate-200'
                        : isDark ? 'border-neutral-700 text-neutral-400 hover:text-neutral-200'
                        : 'border-slate-200 text-slate-500 hover:text-slate-700'}`}
                  >
                    {!isDark
                      ? <><Moon className="h-3.5 w-3.5" /> Dark mode</>
                      : <><Sun  className="h-3.5 w-3.5" /> Light mode</>}
                  </button>
                </div>
              )}

              {/* Text content */}
              {activeLesson?.type === 'text' && (
                <article
                  className={`text-base sm:text-[1.05rem] leading-[1.85] whitespace-pre-line
                    ${isDarkText ? 'text-slate-300' : isDark ? 'text-neutral-300' : 'text-slate-700'}`}
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  <LinkifiedText text={activeLesson.content} />
                </article>
              )}

              {/* Downloads */}
              {!!activeLesson?.resources?.length && (
                <div className={`mt-10 pt-6 border-t ${isDarkText ? 'border-white/10' : isDark ? 'border-neutral-800' : 'border-slate-100'}`}>
                  <p className={`text-xs font-mono uppercase tracking-wider mb-3
                    ${isDarkText ? 'text-slate-500' : isDark ? 'text-neutral-500' : 'text-slate-400'}`}>
                    Downloads
                  </p>
                  <ul className="space-y-2">
                    {activeLesson.resources.map((r, i) => (
                      <li key={i}>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-amber-600 hover:underline font-medium"
                        >
                          <Download className="h-4 w-4" />
                          {r.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
               <button
                 onClick={handleCompleteClick}
                 aria-disabled={completeBusy || !hasLessons || !activeHasContent || undefined}
                 className={`inline-flex sm:order-2 mt-4 items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition
                   ${completeBusy
                     ? 'bg-slate-700 text-white cursor-wait'
                     : !hasLessons || !activeHasContent
                       ? 'bg-transparent border border-slate-300 text-slate-400 opacity-50 cursor-not-allowed'
                       : isDoneLesson
                         ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                         : isDark
                           ? 'bg-amber-500 text-black hover:bg-amber-400'
                           : 'bg-transparent border border-slate-700 text-black hover:bg-slate-700 hover:text-white'}`}
               >
                 {completeBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                 {isDoneLesson && !completeBusy && <CheckCircle2 className="h-4 w-4" />}
                 {completeBusy ? 'Saving…' : isDoneLesson ? 'Completed' : 'Mark complete'}
               </button>
            </div>

            {allComplete && hasCertificate(course) && (
              <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4">
                <div>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">Course complete 🎉</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">Your certificate is ready to download.</p>
                </div>
                <button onClick={() => setCertOpen(true)} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 transition">
                  Get certificate
                </button>
              </div>
            )}

            {/* Bottom nav: prev / mark complete / next */}
            <div className={`mt-12 pt-6 border-t flex items-center justify-between gap-3 w-full flex-wrap
              ${isDarkText ? 'border-white/10' : isDark ? 'border-neutral-800' : 'border-slate-100'}`}>

              {/* Previous */}
              <button
                onClick={() => goTo(lessonIdx - 1)}
                disabled={!hasPrev}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5  bg-gray-200 rounded-lg text-sm font-medium transition
                  ${hasPrev
                    ? isDark
                      ? 'text-neutral-300 bg-white/5 hover:bg-white/50 border border-neutral-700'
                      : 'text-slate-600 hover:bg-slate-50 border border-slate-200'
                    : 'opacity-30 cursor-not-allowed border border-transparent text-slate-400'}`}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>

              {/* Mark complete */}
             
              {/* Next */}
              <button
                onClick={() => goTo(lessonIdx + 1)}
                disabled={!hasNext}
                className={`inline-flex sm:order-1 items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition
                  ${hasNext
                    ? 'bg-amber-500 text-black hover:bg-amber-400'
                    : 'opacity-30 cursor-not-allowed bg-slate-100 text-slate-400'}`}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Lesson counter */}
            <p className={`text-center text-xs font-mono mt-4
              ${isDark ? 'text-neutral-600' : 'text-slate-300'}`}>
              {lessonIdx + 1} of {lessons.length} lessons
            </p>
          </div>
        </div>
      </main>

      {certOpen && (
        <CertificateModal
          open
          course={course}
          name={profile?.name || user?.displayName || user?.email?.split('@')[0] || 'Student'}
          onClose={() => setCertOpen(false)}
        />
      )}

      {certLocked && (
        <CertificateLockModal
          open
          onClose={() => setCertLocked(false)}
          message={`Finish every lesson in ${course.title} to unlock your certificate — ${lessons.length - lessons.filter(l => completedIds.includes(l.id)).length} lesson${lessons.length - lessons.filter(l => completedIds.includes(l.id)).length === 1 ? '' : 's'} to go.`}
        />
      )}

      <Sidebar
        course={course}
        activeLessonId={activeLesson?.id}
        completedIds={completedIds}
        onSelect={l => { setActiveLesson(l); setSidebarOpen(false) }}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        onCollapsedChange={setSidebarCollapsed}
        onCertificate={requestCertificate}
      />
    </div>
  )
}
