import { Globe, BookOpen } from 'lucide-react'

/**
 * Full-screen (or inline) branded preloader.
 *
 * Props:
 * - overlay: true = fixed full-screen over the whole app (default)
 *            false = fills its parent container instead (e.g. inside a section)
 * - transparent: true = see-through white wash (bg-white/70 + blur)
 *                false = solid white background (default)
 * - label: text shown under the CoursePress mark (default: "Loading")
 */
export default function Preloader({ overlay = true, transparent = false, label = 'Loading' }) {
  return (
    <div
      className={`
        ${overlay ? 'fixed inset-0 z-[100]' : 'absolute inset-0'}
        flex flex-col items-center justify-center gap-5
        ${transparent ? 'bg-white/70 backdrop-blur-md' : 'bg-white'}
        dark:bg-neutral-950 ${transparent ? 'dark:bg-neutral-950/70' : ''}
      `}
    >
      {/* Icon mark: globe with a book badge, wrapped in a soft pulse ring */}
      <div className="relative flex items-center justify-center">
        <span className="absolute h-20 w-20 rounded-full bg-amber-400/20 preloader-ping" />
        <span className="absolute h-20 w-20 rounded-full bg-amber-400/10 preloader-ping preloader-ping-delay" />

        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-black shadow-[0_12px_28px_-10px_rgba(0,0,0,0.35)]">
          <Globe className="h-8 w-8 text-amber-400 preloader-spin" strokeWidth={1.75} />
          <span className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 ring-4 ring-white dark:ring-neutral-950">
            <BookOpen className="h-3.5 w-3.5 text-black" strokeWidth={2} />
          </span>
        </div>
      </div>

      {/* Wordmark */}
      <div className="flex flex-col items-center gap-1.5">
        <p className="font-display text-lg font-semibold tracking-tight text-neutral-950 dark:text-white">
          Course<span className="text-amber-600">Press</span>
        </p>
        <p className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          {label}
          <span className="preloader-dot" style={{ animationDelay: '0ms' }}>.</span>
          <span className="preloader-dot" style={{ animationDelay: '160ms' }}>.</span>
          <span className="preloader-dot" style={{ animationDelay: '320ms' }}>.</span>
        </p>
      </div>

      <style>{`
        .preloader-spin {
          animation: preloaderSpin 3.2s linear infinite;
          will-change: transform;
          backface-visibility: hidden;
          -webkit-font-smoothing: antialiased;
        }
        @keyframes preloaderSpin {
          from { transform: rotate(0deg) translateZ(0); }
          to   { transform: rotate(360deg) translateZ(0); }
        }
        .preloader-ping {
          animation: preloaderPing 2.2s cubic-bezier(0, 0, 0.2, 1) infinite;
          will-change: transform, opacity;
          backface-visibility: hidden;
        }
        .preloader-ping-delay {
          animation-delay: 1.1s;
        }
        @keyframes preloaderPing {
          0%   { transform: scale(0.9) translateZ(0); opacity: 0.8; }
          75%, 100% { transform: scale(1.6) translateZ(0); opacity: 0; }
        }
        .preloader-dot {
          display: inline-block;
          animation: preloaderDot 1.1s ease-in-out infinite;
          will-change: opacity, transform;
          backface-visibility: hidden;
        }
        @keyframes preloaderDot {
          0%, 80%, 100% { opacity: 0.25; transform: translateY(0) translateZ(0); }
          40%           { opacity: 1;    transform: translateY(-2px) translateZ(0); }
        }
        @media (max-width: 768px) {
          .preloader-spin {
            animation: preloaderSpin 3.2s linear infinite;
          }
          .preloader-ping {
            animation: preloaderPing 2.4s cubic-bezier(0, 0, 0.2, 1) infinite;
          }
          .preloader-dot {
            animation: preloaderDot 1.3s ease-in-out infinite;
          }
        }
      `}</style>
    </div>
  )
}