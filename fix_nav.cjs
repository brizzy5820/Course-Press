const fs = require('fs')
const path = 'C:\\Users\\User\\Desktop\\work\\COURSE SALES PLATFORM\\src\\pages\\CoursePlayer.jsx'
const content = fs.readFileSync(path, 'utf8')

const oldBlock = `{/* Bottom nav: prev / mark complete / next */}
            <div className={\`mt-12 pt-6 border-t flex items-center justify-between gap-3 w-full flex-wrap
              \${isDarkText ? 'border-white/10' : isDark ? 'border-neutral-800' : 'border-slate-100'}\`}>

              {/* Previous */}
              <button
                onClick={() => goTo(lessonIdx - 1)}
                disabled={!hasPrev}
                className={\`inline-flex items-center gap-1.5 px-4 py-2.5  bg-gray-200 rounded-lg text-sm font-medium transition
                  \${hasPrev
                    ? isDark
                      ? 'text-neutral-300 bg-white/5 hover:bg-white/50 border border-neutral-700'
                      : 'text-slate-600 hover:bg-slate-50 border border-slate-200'
                    : 'opacity-30 cursor-not-allowed border border-transparent text-slate-400'}\`}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>

              {/* Mark complete */}
             
              {/* Next */}
              <button
                onClick={() => goTo(lessonIdx + 1)}
                disabled={!hasNext}
                className={\`inline-flex sm:order-1 items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition
                  \${hasNext
                    ? 'bg-amber-500 text-black hover:bg-amber-400'
                    : 'opacity-30 cursor-not-allowed bg-slate-100 text-slate-400'}\`}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Lesson counter */}
            <p className={\`text-center text-xs font-mono mt-4
              \${isDark ? 'text-neutral-600' : 'text-slate-300'}\`}>
              {lessonIdx + 1} of {lessons.length} lessons
            </p>
          </div>
        </div>
      </main>
      {certOpen && (`

const newBlock = `{/* Bottom nav: prev / mark complete / next */}
            <div className={\`mt-12 pt-6 border-t flex items-center justify-between gap-3 w-full flex-wrap
              \${isDarkText ? 'border-white/10' : isDark ? 'border-neutral-800' : 'border-slate-100'}\`}>

              {/* Previous */}
              <button
                onClick={() => goTo(lessonIdx - 1)}
                disabled={!hasPrev}
                className={\`inline-flex items-center gap-1.5 px-4 py-2.5  bg-gray-200 rounded-lg text-sm font-medium transition
                  \${hasPrev
                    ? isDark
                      ? 'text-neutral-300 bg-white/5 hover:bg-white/50 border border-neutral-700'
                      : 'text-slate-600 hover:bg-slate-50 border border-slate-200'
                    : 'opacity-30 cursor-not-allowed border border-transparent text-slate-400'}\`}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>

              {/* Mark complete */}
             
              {/* Next */}
              <button
                onClick={() => goTo(lessonIdx + 1)}
                disabled={!hasNext}
                className={\`inline-flex sm:order-1 items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition
                  \${hasNext
                    ? 'bg-amber-500 text-black hover:bg-amber-400'
                    : 'opacity-30 cursor-not-allowed bg-slate-100 text-slate-400'}\`}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Lesson counter */}
            <p className={\`text-center text-xs font-mono mt-4
              \${isDark ? 'text-neutral-600' : 'text-slate-300'}\`}>
              {lessonIdx + 1} of {lessons.length} lessons
            </p>
          </div>
        </div>
      </main>

      {/* Fixed bottom navigation — chevron icons only */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 sm:px-8 pb-4 lg:pb-6 pointer-events-none lg:ml-[288px] transition-all duration-300" style={{ marginLeft: sidebarCollapsed ? '96px' : '288px' }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 pointer-events-auto">
          {/* Previous — fixed left */}
          <button
            onClick={() => goTo(lessonIdx - 1)}
            disabled={!hasPrev}
            className={\`inline-flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all duration-200
              \${hasPrev
                ? isDark
                  ? 'bg-neutral-800 text-neutral-100 hover:bg-neutral-700 border border-neutral-700'
                  : 'bg-white text-slate-900 hover:bg-slate-50 border border-slate-200'
                : 'opacity-20 cursor-not-allowed bg-slate-100 dark:bg-neutral-800'}\`}
            aria-label="Previous lesson"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          {/* Next — fixed right */}
          <button
            onClick={() => goTo(lessonIdx + 1)}
            disabled={!hasNext}
            className={\`inline-flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all duration-200
              \${hasNext
                ? 'bg-amber-500 text-white hover:bg-amber-400'
                : 'opacity-20 cursor-not-allowed bg-slate-200 dark:bg-neutral-700'}\`}
            aria-label="Next lesson"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      </nav>

      {certOpen && (`


if (content.includes(oldBlock)) {
  const newContent = content.replace(oldBlock, newBlock)
  fs.writeFileSync('C:\\Users\\User\\Desktop\\work\\COURSE SALES PLATFORM\\src\\pages\\CoursePlayer.jsx', newContent, 'utf8')
  console.log('Fixed successfully')
} else {
  console.log('Old block not found')
  // Try to find similar
  const idx = content.indexOf('Bottom nav: prev')
  if (idx >= 0) {
    console.log('Found at index:', idx)
    console.log('Context:', content.substring(idx, idx + 200))
  }
}