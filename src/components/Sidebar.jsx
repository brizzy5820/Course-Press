import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, CheckCircle2, PlayCircle, FileText, X, Menu, ArrowLeft } from 'lucide-react'

/**
 * Design system note (shared across Sidebar / Dashboard / CourseDetail):
 *   - ink:      zinc-950/900        → headings, primary text
 *   - brand:    indigo-600/500/400  → active state, progress, primary actions
 *   - success:  emerald-500/600     → completed lesson / completed course only
 *   - display type: font-serif      → titles (editorial, distinct from UI chrome)
 *   - coordinates:  font-mono + tabular-nums → module.lesson numbering, durations
 *
 * Integration note: the mobile top bar below is fixed and 56px (h-14) tall.
 * If this Sidebar is rendered next to a <main> in a lesson-player layout,
 * give that <main> a matching `pt-14 lg:pt-0` so content doesn't sit under it.
 */

export default function Sidebar({ course, activeLessonId, completedIds, onSelect, open, onToggle }) {
  const totalLessons    = (course.curriculum || []).reduce((s, m) => s + (m.lessons?.length || 0), 0)
  const completedCount  = completedIds.length
  const progressPercent = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0

  return (
    <>
      {/* Mobile top bar — replaces the old floating button so it never overlaps page content */}
      <div className="lg:hidden fixed inset-x-0 top-0 z-40 h-14  backdrop-blur border-b border-white/[0.08] flex items-center gap-3 px-4">
        <button
          onClick={onToggle}
          aria-label="Toggle course contents"
          aria-expanded={open}
          className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center text-black  hover:bg-white/[0.06] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          {open ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
        </button>
       
      </div>

      {/* Sidebar panel */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 flex flex-col
          w-[288px] bg-zinc-950 text-zinc-300 border-r border-white/[0.06]
          pt-14 lg:pt-0
          transform transition-transform duration-300 ease-out lg:translate-x-0
          ${open ? 'translate-x-0 shadow-2xl shadow-black/40' : '-translate-x-full'}`}
      >
        {/* Header (desktop) */}
        <div className="hidden lg:block px-6 pt-6 pb-5 border-b border-white/[0.06] flex-shrink-0">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-indigo-400 transition mb-4 group"
          >
            <ArrowLeft className="h-3 w-3 group-hover:-translate-x-0.5 transition" />
            My library
          </Link>
          <h2 className="font-serif font-semibold text-[16px] text-white leading-snug line-clamp-2 tracking-tight">
            {course.title}
          </h2>

          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-zinc-500">{completedCount} of {totalLessons} lessons</span>
              <span className="text-xs font-semibold text-indigo-400 tabular-nums">{progressPercent}%</span>
            </div>
            <div className="h-[5px] rounded-full bg-white/[0.07] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-700"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Compact header (mobile, inside the drawer, below the fixed top bar) */}
        <div className="lg:hidden px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 mb-3">
            <ArrowLeft className="h-3 w-3" /> My library
          </Link>
          <div className="h-[5px] rounded-full bg-white/[0.07] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Module list */}
        <nav className="flex-1 overflow-y-auto py-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
          {(course.curriculum || []).map((mod, mi) => (
            <ModuleBlock
              key={mod.id}
              mod={mod}
              moduleIndex={mi + 1}
              activeLessonId={activeLessonId}
              completedIds={completedIds}
              onSelect={onSelect}
            />
          ))}
        </nav>
      </aside>

      {/* Mobile backdrop */}
      {open && (
        <div
          onClick={onToggle}
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-30 lg:hidden"
        />
      )}
    </>
  )
}

function ModuleBlock({ mod, moduleIndex, activeLessonId, completedIds, onSelect }) {
  const [expanded, setExpanded] = useState(true)
  const lessons   = mod.lessons || []
  const doneCount = lessons.filter(l => completedIds.includes(l.id)).length
  const allDone   = lessons.length > 0 && doneCount === lessons.length

  return (
    <div className="mb-0.5">
      {/* Module header */}
      <button
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-2.5 px-5 py-3 hover:bg-white/[0.04] transition text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/50"
      >
        <span className={`shrink-0 transition-transform duration-200 text-zinc-600 group-hover:text-zinc-400 ${expanded ? '' : '-rotate-90'}`}>
          <ChevronDown className="h-3.5 w-3.5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider font-mono">
            Module {moduleIndex}
          </p>
          <p className="text-[13px] font-semibold text-zinc-100 mt-0.5 truncate">{mod.title}</p>
        </div>
        {allDone ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        ) : (
          <span className="text-[10px] font-medium text-zinc-600 shrink-0 tabular-nums font-mono">
            {doneCount}/{lessons.length}
          </span>
        )}
      </button>

      {/* Lessons */}
      {expanded && (
        <ul className="pb-1">
          {lessons.map((lesson, li) => {
            const isActive = lesson.id === activeLessonId
            const isDone   = completedIds.includes(lesson.id)
            const numLabel = `${moduleIndex}.${li + 1}`

            return (
              <li key={lesson.id}>
                <button
                  onClick={() => onSelect(lesson)}
                  className={`w-full flex items-start gap-3 pl-5 pr-4 py-2.5 transition-colors text-left relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/50
                    ${isActive ? 'bg-indigo-500/10' : 'hover:bg-white/[0.03]'}`}
                >
                  {/* Active accent bar */}
                  <span className={`absolute left-0 top-0 bottom-0 w-[2.5px] rounded-r-full transition-colors ${isActive ? 'bg-indigo-500' : 'bg-transparent'}`} />

                  {/* Completion icon */}
                  <span className={`shrink-0 mt-0.5 ${isDone ? 'text-emerald-500' : isActive ? 'text-indigo-400' : 'text-zinc-600'}`}>
                    {isDone
                      ? <CheckCircle2 className="h-3.5 w-3.5" />
                      : lesson.type === 'video'
                        ? <PlayCircle className="h-3.5 w-3.5" />
                        : <FileText className="h-3.5 w-3.5" />}
                  </span>

                  <div className="flex-1 min-w-0">
                    <span className={`font-mono text-[10px] tabular-nums ${isActive ? 'text-indigo-400' : 'text-zinc-600'}`}>
                      {numLabel}
                    </span>
                    <p className={`text-[13px] leading-snug mt-0.5 line-clamp-2
                      ${isActive ? 'text-white font-medium' : isDone ? 'text-zinc-500' : 'text-zinc-300'}`}>
                      {lesson.title}
                    </p>
                    {lesson.durationMin && (
                      <p className="text-[10px] font-mono text-zinc-600 mt-1 tabular-nums">{lesson.durationMin} min</p>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}