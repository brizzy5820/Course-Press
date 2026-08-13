import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, PanelLeft, CheckCircle2, PlayCircle, FileText, X, ArrowLeft, Menu, Moon, Sun } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

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
  const { theme, toggleTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const navigate        = useNavigate()
  const isDark          = theme === 'dark'

  return (
    <>
      {/* Mobile top bar */}
      <div className={`lg:hidden fixed inset-x-0 top-0 z-40 h-14 backdrop-blur border-b flex items-center justify-between px-4
        ${isDark ? 'bg-neutral-950/90 border-white/[0.08]' : 'bg-white/90 border-gray-200'}`}>
        {/* Back arrow */}
        <button
          onClick={() => navigate(`/courses/${course.id}`)}
          aria-label="Go back"
          className={`shrink-0 h-9 w-9 rounded-lg flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60
            ${isDark ? 'text-zinc-400 hover:text-white hover:bg-white/[0.06]' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'}`}
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>

        {/* Hamburger — opens RIGHT sidebar */}
        <button
          onClick={onToggle}
          aria-label="Toggle course contents"
          aria-expanded={open}
          className={`shrink-0 h-9 w-9 rounded-lg flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60
            ${isDark ? 'text-zinc-400 hover:text-white hover:bg-white/[0.06]' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'}`}
        >
          {open ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
        </button>
      </div>

      {/* Sidebar panel: mobile drawer on the right, fixed course rail on desktop */}
      <aside
        className={`fixed inset-y-0 right-0 lg:left-0 lg:right-auto z-40 flex flex-col overflow-hidden
          ${collapsed ? 'w-20 lg:w-20' : 'w-[288px] lg:w-[288px]'} border-l
          lg:border-l-0 lg:border-r pt-14 lg:pt-0 lg:shadow-2xl
          transform transition-all duration-300 ease-out lg:translate-x-0
          ${isDark
            ? 'bg-zinc-950 text-zinc-300 border-white/[0.06]'
            : 'bg-white text-neutral-700 '}
          ${open ? 'translate-x-0 shadow-2xl shadow-black/40' : 'translate-x-full'}`}
      >
        {/* Header (desktop) */}
        <div className={`hidden lg:flex   flex-col px-6 pt-6 pb-5 border-b flex-shrink-0 ${isDark ? 'border-white/[0.06]' : 'border-neutral-200'}`}>
          <div className="flex items-start justify-between gap-3">
            {!collapsed && (
              <div>
                <Link
                  to="/dashboard"
                  className={`inline-flex items-center gap-1.5 text-[11px] font-medium transition mb-4 group
                    ${isDark ? 'text-zinc-500 hover:text-amber-400' : 'text-neutral-400 hover:text-amber-600'}`}
                >
                  <ArrowLeft className="h-3 w-3 group-hover:-translate-x-0.5 transition" />
                  My library
                </Link>
                <h2 className={`font-semibold text-[16px] leading-snug line-clamp-2 tracking-tight
                  ${isDark ? 'text-white' : 'text-neutral-950'}`}>
                  {course.title}
                </h2>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className={`inline-flex items-center justify-center h-9 w-9 rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60
                  ${isDark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-black/5 text-black hover:bg-black/10'}`}
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setCollapsed(c => !c)}
                className={`inline-flex items-center justify-center h-9 w-9 rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60
                  ${isDark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-black/5 text-black hover:bg-black/10'}`}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <PanelLeft  className={`h-4 w-4 transition ${collapsed ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {!collapsed && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-neutral-400'}`}>{completedCount} of {totalLessons} lessons</span>
                <span className="text-xs font-semibold text-amber-700 tabular-nums">{progressPercent}%</span>
              </div>
              <div className={`h-[5px] rounded-full overflow-hidden ${isDark ? 'bg-white/[0.07]' : 'bg-neutral-100'}`}>
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-700"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Compact header (mobile, inside the drawer, below the fixed top bar) */}
        <div className={`lg:hidden px-5 py-4 border-b flex-shrink-0 ${isDark ? 'border-white/[0.06]' : 'border-neutral-200'}`}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <Link to="/dashboard" className={`inline-flex items-center gap-1.5 text-[11px] font-medium
              ${isDark ? 'text-zinc-500' : 'text-neutral-400'}`}>
              <ArrowLeft className="h-3 w-3" /> My library
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className={`inline-flex items-center justify-center h-9 w-9 rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60
                ${isDark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-black/5 text-black hover:bg-black/10'}`}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
          <div className={`h-[5px] rounded-full overflow-hidden ${isDark ? 'bg-white/[0.07]' : 'bg-neutral-100'}`}>
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Module list */}
        <nav className={`flex-1 overflow-y-auto py-2 ${collapsed ? 'lg:hidden' : ''} [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full
          ${isDark ? '[&::-webkit-scrollbar-thumb]:bg-white/10' : '[&::-webkit-scrollbar-thumb]:bg-neutral-200'}`}>
          {(course.curriculum || []).map((mod, mi) => (
            <ModuleBlock
              key={mod.id}
              mod={mod}
              moduleIndex={mi + 1}
              activeLessonId={activeLessonId}
              completedIds={completedIds}
              onSelect={onSelect}
              isDark={isDark}
            />
          ))}
        </nav>
      </aside>

      {/* Mobile backdrop */}
      {open && (
        <div
          onClick={onToggle}
          className={`fixed inset-0 backdrop-blur-[2px] z-30 lg:hidden ${isDark ? 'bg-black/60' : 'bg-black/30'}`}
        />
      )}
    </>
  )
}

function ModuleBlock({ mod, moduleIndex, activeLessonId, completedIds, onSelect, isDark }) {
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
        className={`w-full flex items-center gap-2.5 px-5 py-3 transition text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500/50
          ${isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-neutral-50'}`}
      >
        <span className={`shrink-0 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}
          ${isDark ? 'text-zinc-600 group-hover:text-zinc-400' : 'text-neutral-400 group-hover:text-neutral-600'}`}>
          <ChevronDown className="h-3.5 w-3.5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-medium uppercase tracking-wider font-mono ${isDark ? 'text-zinc-600' : 'text-neutral-400'}`}>
            Module {moduleIndex}
          </p>
          <p className={`text-[13px] font-semibold mt-0.5 truncate ${isDark ? 'text-zinc-100' : 'text-neutral-900'}`}>{mod.title}</p>
        </div>
        {allDone ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        ) : (
          <span className={`text-[10px] font-medium shrink-0 tabular-nums font-mono ${isDark ? 'text-zinc-600' : 'text-neutral-400'}`}>
            {doneCount}/{lessons.length}
          </span>
        )}
      </button>

      {/* Lessons */}
      {expanded && (
        <ul className="pb-1">
          {lessons.map((lesson, li) => {
            const isActive = lesson.id === activeLessonId
            const isDoneL  = completedIds.includes(lesson.id)
            const numLabel = `${moduleIndex}.${li + 1}`

            return (
              <li key={lesson.id}>
                <button
                  onClick={() => onSelect(lesson)}
                  className={`w-full flex items-start gap-3 pl-5 pr-4 py-2.5 transition-colors text-left relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500/50
                    ${isActive
                      ? isDark ? 'bg-amber-500/10' : 'bg-amber-50'
                      : isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-neutral-50'}`}
                >
                  {/* Active accent bar */}
                  <span className={`absolute left-0 top-0 bottom-0 w-[2.5px] rounded-r-full transition-colors ${isActive ? 'bg-amber-500' : 'bg-transparent'}`} />

                  {/* Completion icon */}
                  <span className={`shrink-0 mt-0.5 ${isDoneL ? 'text-emerald-500' : isActive ? 'text-amber-500' : isDark ? 'text-zinc-600' : 'text-neutral-400'}`}>
                    {isDoneL
                      ? <CheckCircle2 className="h-3.5 w-3.5" />
                      : lesson.type === 'video'
                        ? <PlayCircle className="h-3.5 w-3.5" />
                        : <FileText className="h-3.5 w-3.5" />}
                  </span>

                  <div className="flex-1 min-w-0">
                    <span className={`font-mono text-[10px] tabular-nums ${isActive ? 'text-amber-500' : isDark ? 'text-zinc-600' : 'text-neutral-400'}`}>
                      {numLabel}
                    </span>
                    <p className={`text-[13px] leading-snug mt-0.5 line-clamp-2
                      ${isActive
                        ? isDark ? 'text-white font-medium' : 'text-amber-700 font-medium'
                        : isDoneL
                          ? isDark ? 'text-zinc-500' : 'text-neutral-400'
                          : isDark ? 'text-zinc-300' : 'text-neutral-700'}`}>
                      {lesson.title}
                    </p>
                    {lesson.durationMin && (
                      <p className={`text-[10px] font-mono mt-1 tabular-nums ${isDark ? 'text-zinc-600' : 'text-neutral-400'}`}>{lesson.durationMin} min</p>
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
