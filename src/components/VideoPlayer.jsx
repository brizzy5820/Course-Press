import { useEffect, useRef, useState } from 'react'

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
  const [rate, setRate] = useState(1)
  const [quality, setQuality] = useState('auto')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    setReady(false)
    loadYouTubeAPI().then(() => {
      if (cancelled) return
      if (playerRef.current) playerRef.current.destroy()
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: youtubeId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: () => setReady(true),
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.ENDED) onEnded?.()
          },
        },
      })
    })
    return () => { cancelled = true }
  }, [youtubeId])

  function applyRate(r) {
    setRate(r)
    playerRef.current?.setPlaybackRate(r)
  }

  function applyQuality(q) {
    setQuality(q)
    playerRef.current?.setPlaybackQuality(q)
  }

  return (
    <div>
      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      <div className="flex flex-wrap gap-3 mt-3 text-xs">
        <div className="flex items-center gap-1 bg-spineLight rounded-lg p-1">
          {RATES.map(r => (
            <button
              key={r}
              disabled={!ready}
              onClick={() => applyRate(r)}
              className={`px-2.5 py-1 rounded-md font-mono ${rate === r ? 'bg-gold text-spine' : 'text-cream/70 hover:text-cream'}`}
            >
              {r}x
            </button>
          ))}
        </div>
        <select
          disabled={!ready}
          value={quality}
          onChange={e => applyQuality(e.target.value)}
          className="bg-spineLight text-cream/70 rounded-lg px-2.5 py-1 font-mono"
        >
          {QUALITIES.map(q => <option key={q.id} value={q.id}>{q.label}</option>)}
        </select>
      </div>
    </div>
  )
}
