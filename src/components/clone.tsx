import { useEffect, useRef, useState } from 'react'
import { Loader, PlayCircle } from 'lucide-react'

declare global {
  interface Window {
    YT?: {
      Player: new (element: HTMLElement | string, options: Record<string, any>) => any
      PlayerState: {
        UNSTARTED: number
        ENDED: number
        PLAYING: number
        PAUSED: number
        BUFFERING: number
        CUED: number
      }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

interface VideoPlayerProps {
  youtubeId?: string | null
  onEnded?: () => void
}

let apiLoadingPromise: Promise<void> | null = null

function loadYouTubeAPI(): Promise<void> {
  if (window.YT && window.YT.Player) return Promise.resolve()
  if (apiLoadingPromise) return apiLoadingPromise

  apiLoadingPromise = new Promise<void>((resolve, reject) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      reject(new Error('You appear to be offline. Connect to the internet to load the video player.'))
      return
    }

    let settled = false
    const cleanup = () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(pollId)
    }
    const finishResolve = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }
    const finishReject = (err: Error) => {
      if (settled) return
      settled = true
      cleanup()
      apiLoadingPromise = null
      reject(err)
    }

    const prevReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      try { prevReady?.() } catch { /* ignore */ }
      finishResolve()
    }

    const pollId = window.setInterval(() => {
      if (window.YT && window.YT.Player) finishResolve()
    }, 100)

    const timeoutId = window.setTimeout(() => {
      finishReject(new Error('Timed out loading the YouTube player. Check your connection or ad blocker.'))
    }, 12000)

    const existing = document.querySelector('script[src*="youtube.com/iframe_api"]')
    if (!existing) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      tag.async = true
      tag.onerror = () => {
        tag.remove()
        finishReject(new Error('Failed to load YouTube player script. Check your internet connection.'))
      }
      document.body.appendChild(tag)
    }
  }).catch((err) => {
    apiLoadingPromise = null
    throw err
  })

  return apiLoadingPromise
}

export function extractYouTubeId(input?: string | null): string {
  if (!input) return ''
  const s = input.trim()
  if (!s) return ''
  // Bare 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s
  // ?v= or &v=
  const vParam = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  if (vParam) return vParam[1]
  // youtu.be/<id>
  const short = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (short) return short[1]
  // /embed/<id>
  const embed = s.match(/\/embed\/([a-zA-Z0-9_-]{11})/)
  if (embed) return embed[1]
  // /shorts/<id>
  const shorts = s.match(/\/shorts\/([a-zA-Z0-9_-]{11})/)
  if (shorts) return shorts[1]
  // /live/<id>
  const live = s.match(/\/live\/([a-zA-Z0-9_-]{11})/)
  if (live) return live[1]
  return s // fallback — let YouTube validate
}

function getYouTubeErrorMessage(code?: number): string {
  switch (code) {
    case 2:
      return 'Invalid YouTube video ID. Check the lesson video link.'
    case 5:
      return 'HTML5 playback error in your browser. Try refreshing or switching browsers.'
    case 100:
      return 'This video was removed or marked Private on YouTube.'
    case 101:
    case 150:
      return 'Video embedding is disabled by the YouTube channel owner. Enable "Allow embedding" in YouTube Studio.'
    default:
      return 'Could not load video. Check the YouTube URL and make sure the video is Unlisted or Public.'
  }
}

const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2]
const QUALITIES = [
  { id: 'small', label: '360p · saves data' },
  { id: 'medium', label: '480p' },
  { id: 'hd720', label: '720p' },
  { id: 'hd1080', label: '1080p' },
  { id: 'auto', label: 'Auto' },
]

export default function VideoPlayer({ youtubeId, onEnded }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<any>(null)
  const onEndedRef = useRef(onEnded)
  const [rate, setRate] = useState(1)
  const [quality, setQuality] = useState('auto')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  // Keep the callback fresh without re-binding YT event listeners
  useEffect(() => {
    onEndedRef.current = onEnded
  }, [onEnded])

  const destroyPlayer = () => {
    if (playerRef.current) {
      try {
        playerRef.current.destroy()
      } catch { /* ignore */ }
      playerRef.current = null
    }
    if (containerRef.current) {
      containerRef.current.replaceChildren()
    }
  }

  // Load / swap the video inside a dedicated imperative mount node so
  // YT.Player's DOM replacement never breaks React reconciliation.
  useEffect(() => {
    let cancelled = false
    let readyFallbackTimer: number | null = null

    setError('')
    setReady(false)

    const videoId = extractYouTubeId(youtubeId)
    if (!videoId) {
      destroyPlayer()
      setError('No video linked to this lesson yet.')
      return
    }

    loadYouTubeAPI()
      .then(() => {
        if (cancelled || !containerRef.current || !window.YT?.Player) return

        // Reuse existing attached player when available
        if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
          playerRef.current.loadVideoById(videoId)
          // Mobile browsers blocking autoplay stay UNSTARTED (-1); clear spinner safely
          readyFallbackTimer = window.setTimeout(() => {
            if (!cancelled) setReady(true)
          }, 1500)
          return
        }

        // Create a fresh imperative element inside containerRef so React retains ownership of containerRef
        const target = document.createElement('div')
        target.className = 'h-full w-full'
        containerRef.current.replaceChildren(target)

        playerRef.current = new window.YT.Player(target, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: () => {
              if (!cancelled) setReady(true)
            },
            onError: (e: { data?: number }) => {
              if (cancelled) return
              destroyPlayer()
              setReady(false)
              setError(getYouTubeErrorMessage(e?.data))
            },
            onStateChange: (e: { data: number }) => {
              if (cancelled) return
              const YTState = window.YT?.PlayerState
              if (!YTState) return
              if (
                e.data === YTState.PLAYING ||
                e.data === YTState.CUED ||
                e.data === YTState.PAUSED ||
                e.data === YTState.BUFFERING
              ) {
                setReady(true)
              }
              if (e.data === YTState.ENDED) {
                onEndedRef.current?.()
              }
            },
          },
        })
      })
      .catch((err: Error) => {
        if (!cancelled) {
          destroyPlayer()
          setReady(false)
          setError(err?.message || 'Unable to load YouTube player.')
        }
      })

    return () => {
      cancelled = true
      if (readyFallbackTimer) window.clearTimeout(readyFallbackTimer)
    }
  }, [youtubeId])

  // Destroy the player cleanly on unmount
  useEffect(() => {
    return () => destroyPlayer()
  }, [])

  function applyRate(r: number) {
    setRate(r)
    playerRef.current?.setPlaybackRate?.(r)
  }

  function applyQuality(q: string) {
    setQuality(q)
    playerRef.current?.setPlaybackQuality?.(q)
  }

  return (
    <div>
      <div className="relative aspect-video rounded-xl overflow-hidden bg-black shadow-lg">
        <div ref={containerRef} className="h-full w-full" />

        {!ready && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-10">
            <Loader className="h-8 w-8 text-amber-500 animate-spin mb-2" />
            <p className="text-xs text-zinc-400 font-medium">Loading video...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-20 bg-slate-900 flex flex-col items-center justify-center gap-2 text-center px-6">
            <PlayCircle className="h-10 w-10 text-white/60" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">Coming soon</p>
            <p className="text-xs text-white/55 max-w-md">{error}</p>
          </div>
        )}
      </div>

      {/* Controls (kept hidden by default; YouTube native player handles speed & quality) */}
      <div className="hidden flex-wrap items-center gap-3 mt-3">
        {/* Playback speed */}
        <div className="flex items-center bg-slate-100 dark:bg-neutral-800 rounded-lg p-0.5 gap-0.5">
          {RATES.map(r => (
            <button
              key={r}
              type="button"
              disabled={!ready}
              onClick={() => applyRate(r)}
              className={`px-2.5 py-1 rounded-md font-mono text-xs transition
                ${rate === r
                  ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                  : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-40'}`}
            >
              {r}x
            </button>
          ))}
        </div>

        {/* Quality */}
        <select
          disabled={!ready}
          value={quality}
          onChange={e => applyQuality(e.target.value)}
          className="text-xs font-mono bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-200 rounded-lg px-2.5 py-1.5 border-none outline-none disabled:opacity-40"
        >
          {QUALITIES.map(q => <option key={q.id} value={q.id}>{q.label}</option>)}
        </select>
      </div>
    </div>
  )
}
