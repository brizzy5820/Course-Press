import { useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, FileText, Menu, Video, X } from 'lucide-react'

export default function Sidebar({ course, activeLessonId, completedIds, onSelect, open, onToggle }) {
  return (
    <>
      <button
        onClick={onToggle}
        className="lg:hidden fixed top-4 left-4 z-30 inline-flex items-center gap-2 rounded-2xl bg-white/95 px-3 py-2 text-sm font-semibold text-ink shadow-sm ring-1 ring-slate-200 transition hover:bg-white"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        <span>{open ? 'Close' : 'Contents'}</span>
      </button>

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-20 w-80 bg-spine text-cream border-r border-white/5 transform transition-transform lg:translate-x-0 overflow-y-auto ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-5 border-b border-white/5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold mb-1">Course</p>
          <h2 className="font-display text-lg font-semibold leading-snug">{course.title}</h2>
        </div>

        <nav className="p-3">
          {(course.curriculum || []).map((mod, mi) => (
            <ModuleBlock
              key={mod.id}
              index={mi + 1}
              mod={mod}
              activeLessonId={activeLessonId}
              completedIds={completedIds}
              onSelect={onSelect}
            />
          ))}
        </nav>
      </aside>

      {open && <div onClick={onToggle} className="fixed inset-0 bg-black/50 z-10 lg:hidden" />}
    </>
  )
}

function ModuleBlock({ index, mod, activeLessonId, completedIds, onSelect }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 text-left"
        aria-expanded={expanded}
      >
        <span className="text-sm font-medium text-cream/90">
          {index}. {mod.title}
        </span>
        {expanded ? <ChevronDown className="h-4 w-4 text-cream/40" /> : <ChevronRight className="h-4 w-4 text-cream/40" />}
      </button>
      {expanded && (
        <ul className="ml-2 border-l border-white/10">
          {(mod.lessons || []).map(lesson => {
            const isActive = lesson.id === activeLessonId
            const isDone = completedIds.includes(lesson.id)
            const Icon = isDone ? CheckCircle2 : lesson.type === 'video' ? Video : FileText
            return (
              <li key={lesson.id}>
                <button
                  onClick={() => onSelect(lesson)}
                  className={`w-full text-left pl-4 pr-3 py-2.5 text-sm flex items-center gap-3 transition ${isActive ? 'bg-gold/15 text-gold' : 'text-cream/65 hover:text-cream hover:bg-white/5'}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="line-clamp-1">{lesson.title}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
