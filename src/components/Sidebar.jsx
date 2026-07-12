import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, CheckCircle2, PlayCircle, FileText, X, Menu } from 'lucide-react'

export default function Sidebar({ course, activeLessonId, completedIds, onSelect, open, onToggle }) {
  const totalLessons    = (course.curriculum || []).reduce((s, m) => s + (m.lessons?.length || 0), 0)
  const completedCount  = completedIds.length
  const progressPercent = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={onToggle}
        aria-label="Toggle course contents"
        className="lg:hidden fixed top-4 left-4 z-30 bg-white border border-slate-200 text-slate-700 rounded-lg p-2 shadow-sm"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {/* Sidebar panel */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-20 flex flex-col
          w-72 bg-slate-900 text-slate-300 border-r border-slate-800
          transform transition-transform duration-200 lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Header */}
        <div className="px-5 pt-6 pb-4 border-b border-slate-800 mt-8 flex-shrink-0">
          <Link to="/" className="text-xs text-right font-medium text-amber-400 tracking-wide">CoursePress</Link>
          <h2 className="font-semibold text-sm text-white mt-2 leading-snug line-clamp-2">
            {course.title}
          </h2>
          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-slate-400">{completedCount} of {totalLessons} lessons</span>
              <span className="text-xs font-medium text-slate-300">{progressPercent}%</span>
            </div>
            <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Module list */}
        <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin scrollbar-thumb-slate-700">
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
          className="fixed inset-0 bg-black/50 z-10 lg:hidden"
        />
      )}
    </>
  )
}

function ModuleBlock({ mod, moduleIndex, activeLessonId, completedIds, onSelect }) {
  const [expanded, setExpanded] = useState(true)
  const lessons      = mod.lessons || []
  const doneCount    = lessons.filter(l => completedIds.includes(l.id)).length
  const allDone      = lessons.length > 0 && doneCount === lessons.length

  return (
    <div className="mb-1">
      {/* Module header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-800 transition text-left group"
      >
        <span className={`shrink-0 transition ${allDone ? 'text-amber-400' : 'text-slate-500'}`}>
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5" />
            : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            Module {moduleIndex}
          </p>
          <p className="text-xs font-semibold text-slate-100 mt-0.5 truncate">{mod.title}</p>
        </div>
        <span className="text-[10px] font-mono text-slate-500 shrink-0">
          {doneCount}/{lessons.length}
        </span>
      </button>

      {/* Lessons */}
      {expanded && (
        <ul className="ml-4 border-l border-slate-800 mb-1">
          {lessons.map((lesson, li) => {
            const isActive  = lesson.id === activeLessonId
            const isDone    = completedIds.includes(lesson.id)
            const numLabel  = `${moduleIndex}.${li + 1}`

            return (
              <li key={lesson.id}>
                <button
                  onClick={() => onSelect(lesson)}
                  className={`w-full flex items-start gap-2.5 pl-4 pr-3 py-2.5 transition text-left
                    ${isActive
                      ? 'bg-amber-500/10 border-l-2 border-amber-400 -ml-px'
                      : 'hover:bg-slate-800/70 border-l-2 border-transparent -ml-px'}`}
                >
                  {/* Completion icon */}
                  <span className={`shrink-0 mt-0.5 ${isDone ? 'text-amber-400' : isActive ? 'text-amber-300' : 'text-slate-500'}`}>
                    {isDone
                      ? <CheckCircle2 className="h-3.5 w-3.5" />
                      : lesson.type === 'video'
                        ? <PlayCircle className="h-3.5 w-3.5" />
                        : <FileText className="h-3.5 w-3.5" />}
                  </span>

                  <div className="flex-1 min-w-0">
                    <span className={`font-mono text-[10px] ${isActive ? 'text-amber-400' : 'text-slate-500'}`}>
                      {numLabel}
                    </span>
                    <p className={`text-xs leading-snug mt-0.5 line-clamp-2
                      ${isActive ? 'text-white font-medium' : isDone ? 'text-slate-400' : 'text-slate-300'}`}>
                      {lesson.title}
                    </p>
                    {lesson.durationMin && (
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">{lesson.durationMin} min</p>
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