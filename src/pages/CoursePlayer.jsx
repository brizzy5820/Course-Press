import { useEffect, useMemo, useState } from 'react'
import { useParams, Navigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getCourse, isEnrolled, getProgress, markLessonComplete, flattenLessons } from '../lib/data'
import Sidebar from '../components/Sidebar'
import VideoPlayer from '../components/VideoPlayer'

export default function CoursePlayer() {
  const { courseId } = useParams()
  const { user } = useAuth()

  const [course, setCourse] = useState(null)
  const [allowed, setAllowed] = useState(null) // null = checking
  const [completedIds, setCompletedIds] = useState([])
  const [activeLesson, setActiveLesson] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [readMode, setReadMode] = useState('light') // 'light' | 'dark', for text lessons

  const lessons = useMemo(() => course ? flattenLessons(course) : [], [course])

  useEffect(() => {
    if (!user) return
    isEnrolled(user.uid, courseId).then(setAllowed)
    getCourse(courseId).then(setCourse)
    getProgress(user.uid, courseId).then(p => setCompletedIds(p.completedLessonIds))
  }, [user, courseId])

  useEffect(() => {
    if (lessons.length && !activeLesson) setActiveLesson(lessons[0])
  }, [lessons])

  if (allowed === false) return <Navigate to={`/courses/${courseId}`} replace />
  if (!course || allowed === null) return <div className="min-h-screen bg-spine" />

  async function toggleComplete() {
    const done = !completedIds.includes(activeLesson.id)
    await markLessonComplete(user.uid, courseId, activeLesson.id, done)
    setCompletedIds(ids => done ? [...ids, activeLesson.id] : ids.filter(i => i !== activeLesson.id))
  }

  function goToNext() {
    const idx = lessons.findIndex(l => l.id === activeLesson.id)
    if (idx < lessons.length - 1) setActiveLesson(lessons[idx + 1])
  }

  const isDone = completedIds.includes(activeLesson?.id)
  const lessonIdx = lessons.findIndex(l => l.id === activeLesson?.id)

  return (
    <div className="min-h-screen flex bg-cream">
      <Sidebar
        course={course}
        activeLessonId={activeLesson?.id}
        completedIds={completedIds}
        onSelect={(l) => { setActiveLesson(l); setSidebarOpen(false) }}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
      />

      <main className="flex-1 min-w-0">
        <div className={`min-h-screen ${activeLesson?.type === 'text' && readMode === 'dark' ? 'bg-spine text-cream' : 'bg-white'}`}>
          <div className="max-w-3xl mx-auto px-6 py-10 lg:py-14">
            <Link to="/dashboard" className="text-xs font-mono text-ash hover:text-goldDeep">← My library</Link>

            <p className="font-mono text-xs uppercase tracking-[0.2em] text-goldDeep mt-4 mb-2">
              {activeLesson?.moduleTitle}
            </p>
            <h1 className="font-display text-3xl font-semibold leading-tight">{activeLesson?.title}</h1>

            <div className="mt-8">
              {activeLesson?.type === 'video' ? (
                <VideoPlayer youtubeId={activeLesson.youtubeId} onEnded={() => {}} />
              ) : (
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => setReadMode(m => m === 'light' ? 'dark' : 'light')}
                    className="text-xs font-mono px-3 py-1.5 rounded-full border border-ink/15"
                  >
                    {readMode === 'light' ? '🌙 Dark mode' : '☀️ Light mode'}
                  </button>
                </div>
              )}
              {activeLesson?.type === 'text' && (
                <article className="prose-reader font-display text-[1.05rem] whitespace-pre-line">
                  {activeLesson.content}
                </article>
              )}
              {!!activeLesson?.resources?.length && (
                <div className="mt-8 border-t border-ink/10 pt-5">
                  <p className="text-xs font-mono uppercase tracking-wide text-ash mb-2">Downloads</p>
                  <ul className="space-y-1">
                    {activeLesson.resources.map((r, i) => (
                      <li key={i}>
                        <a href={r.url} target="_blank" rel="noreferrer" className="text-goldDeep hover:underline text-sm">
                          ⬇ {r.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-12 flex items-center justify-between gap-4 border-t border-ink/10 pt-6">
              <button
                onClick={toggleComplete}
                className={`px-5 py-3 rounded-lg font-medium text-sm transition
                  ${isDone ? 'bg-sage/15 text-sage' : 'bg-spine text-cream hover:bg-spineLight'}`}
              >
                {isDone ? '✅ Completed' : 'Mark as complete'}
              </button>
              {lessonIdx < lessons.length - 1 && (
                <button onClick={goToNext} className="text-sm font-medium text-goldDeep hover:underline">
                  Next lesson →
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
