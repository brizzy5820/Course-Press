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
const previousVideoIdRef = useRef(null)
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
useEffect(() => {
let cancelled = false
const extractedId = extractYouTubeId(youtubeId)
const previousId = previousVideoIdRef.current

// Only reset ready state if video ID actually changed
if (extractedId !== previousId) {
setReady(false)
previousVideoIdRef.current = extractedId
}

loadYouTubeAPI().then(() => {
if (cancelled) return
if (playerRef.current) playerRef.current.destroy()
playerRef.current = new window.YT.Player(containerRef.current, {
videoId: extractedId,
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
const hasVideoId = extractYouTubeId(youtubeId)

if(error || !hasVideoId){
return(
<div className="aspect-video rounded-xl bg-slate-900 flex flex-col items-center justify-center gap-2 text-center px-6">
<PlayCircle className="h-10 w-10 text-white/60" />
<p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">Coming soon</p>
<p className="text-xs text-white/45">{error || 'No video available'}</p>
</div>
)
}

return (
<div>
<div className="relative aspect-video rounded-xl overflow-hidden bg-black shadow-lg">
<div className="aspect-video rounded-xl overflow-hidden bg-black">
<div ref={containerRef} className="h-full w-full" />
</div>
{!ready && (
<div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-10">
<Loader className="h-8 w-8 rounded-full text-amber-500 border-amber-500 border-t-transparent animate-spin mb-2" />
<p className="text-xs text-zinc-400 font-medium">Loading video...</p>
</div>
)}
{/* <div ref={containerRef} className="h-full w-full" /> */}
</div>
</div>
)
}