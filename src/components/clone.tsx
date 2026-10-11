import { useEffect, useRef, useState } from 'react'
import { Loader, PlayCircle } from 'lucide-react'

let apiLoadingPromise = null
function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve()
  if (apiLoadingPromise) return apiLoadingPromise
  apiLoadingPromise = new Promise(resolve => {
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.body.appendChild(tag)
    window.onYouTubeIframeAPIReady = () => resolve()
  })
  return apiLoadingPromise
}

const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2]
const QUALITIES = [
  { id: 'small', label: '360p · saves data' },
  { id: 'medium', label: '480p' },
  { id: 'hd720', label: '720p' },
  { id: 'hd1080', label: '1080p' },
  { id: 'auto', label: 'Auto' },
]


export default function VideoPlayer({ youtubeId, onEnded }) {
  const containerRef = useRef(null)
  const playerRef = useRef(null)
  const onEndedRef = useRef(onEnded)
  const [rate, setRate] = useState(1)
  const [quality, setQuality] = useState('auto')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  function extractYouTubeId(input) {
  if (!input) return ''
  const s = input.trim()
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
  return s // fallback — let YouTube decide
}


  // Keep the callback fresh without re-binding YT event listeners
  useEffect(() => { onEndedRef.current = onEnded }, [onEnded])

  // Load / swap the video. The player itself is created ONCE and reused —
  // never destroyed and recreated — because YT.Player() replaces the
  // container <div> with an <iframe> in the real DOM. Destroying and
  // re-targeting containerRef.current on every lesson change hits a
  // detached node and shows a black screen. loadVideoById() swaps the
  // video inside the same, still-attached iframe instead.
  useEffect(() => {
    let cancelled = false
    setError('')

    const videoId = extractYouTubeId(youtubeId)
    if (!videoId) {
      setReady(false)
      setError('No video linked to this lesson yet.')
      return
    }

    loadYouTubeAPI().then(() => {
      if (cancelled) return

      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        setReady(false)
        playerRef.current.loadVideoById(videoId)
        return
      }

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: () => { if (!cancelled) setReady(true) },
          onError: () => { if (!cancelled) setError('Could not load video. Check the YouTube URL and make sure the video is Unlisted or Public.') },
          onStateChange: (e) => {
            if (cancelled) return
            // Handles the "ready" flip for every subsequent loadVideoById()
            // call too, since this listener stays bound for the player's life.
            if (e.data === window.YT.PlayerState.PLAYING || e.data === window.YT.PlayerState.CUED) {
              setReady(true)
            }
            if (e.data === window.YT.PlayerState.ENDED) onEndedRef.current?.()
          },
        },
      })
    })

    return () => { cancelled = true }
  }, [youtubeId])

  // Only destroy the player when the component actually unmounts.
  useEffect(() => {
    return () => {
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [])

  function applyRate(r) {
    setRate(r)
    playerRef.current?.setPlaybackRate(r)
  }

  function applyQuality(q) {
    setQuality(q)
    playerRef.current?.setPlaybackQuality(q)
  }
  if (error) {
    return (
      <div className="aspect-video rounded-xl bg-slate-900 flex flex-col items-center justify-center gap-2 text-center px-6">
        <PlayCircle className="h-10 w-10 text-white/60" />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">Coming soon</p>
        <p className="text-xs text-white/45">{error}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="relative aspect-video rounded-xl overflow-hidden bg-black shadow-lg">
          <div ref={containerRef} className="h-full w-full" />
        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-10">
            <Loader className="h-8 w-8 rounded-full text-amber-500 border-amber-500 border-t-transparent animate-spin mb-2" />
            <p className="text-xs text-zinc-400 font-medium">Loading video...</p>
          </div>
        )}
      
      </div>

      {/* Controls */}
      <div className="flex flex-wrap hidden items-center gap-3 mt-3">
        {/* Playback speed */}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
          {RATES.map(r => (
            <button
              key={r}
              disabled={!ready}
              onClick={() => applyRate(r)}
              className={`px-2.5 py-1 rounded-md font-mono text-xs transition
                ${rate === r
                  ? 'bg-white text-ink shadow-sm font-semibold'
                  : 'text-slate-500 hover:text-ink disabled:opacity-40'}`}
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
          className="text-xs font-mono bg-slate-100 text-slate-600 rounded-lg px-2.5 py-1.5 border-none outline-none disabled:opacity-40"
        >
          {QUALITIES.map(q => <option key={q.id} value={q.id}>{q.label}</option>)}
        </select>
      </div>
    </div>
  )
}