import { useRef, useState, useEffect } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Loader2 } from 'lucide-react'

export default function AudioPlayer({ 
  src, 
  title, 
  onEnded,
  onTimeUpdate 
}) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [playbackRate, setPlaybackRate] = useState(1)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      setLoading(false)
    }
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      onTimeUpdate?.(audio.currentTime, audio.duration)
    }
    const handleEnded = () => {
      setPlaying(false)
      onEnded?.()
    }
    const handleError = () => {
      setError(audio.error?.message || 'Failed to load audio')
      setLoading(false)
    }
    const handleWaiting = () => setLoading(true)
    const handleCanPlay = () => setLoading(false)

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('waiting', handleWaiting)
    audio.addEventListener('canplay', handleCanPlay)

    audio.volume = volume
    audio.playbackRate = playbackRate

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('waiting', handleWaiting)
      audio.removeEventListener('canplay', handleCanPlay)
    }
  }, [volume, playbackRate, onTimeUpdate, onEnded])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      audio.play().catch(() => setError('Playback failed'))
    }
    setPlaying(!playing)
  }

  const handleSeek = (e) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    audio.currentTime = percent * duration
  }

  const handleVolumeChange = (e) => {
    const audio = audioRef.current
    const v = parseFloat(e.target.value)
    setVolume(v)
    if (audio) audio.volume = v
    setMuted(v === 0)
  }

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return
    if (muted) {
      audio.volume = volume
      setMuted(false)
    } else {
      audio.volume = 0
      setMuted(true)
    }
  }

  const skip = (seconds) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + seconds))
  }

  const changeRate = (rate) => {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = rate
    setPlaybackRate(rate)
  }

  const formatTime = (sec) => {
    if (!isFinite(sec)) return '0:00'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-6 text-center">
        <p className="text-red-600 dark:text-red-400">Failed to load audio</p>
        <p className="text-xs text-red-500/70 mt-1">{error}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 p-4 space-y-3">
      {title && (
        <p className="font-medium text-slate-900 dark:text-white truncate">{title}</p>
      )}

      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Progress bar */}
      <div className="relative">
        <div
          className="h-2 bg-slate-200 dark:bg-neutral-700 rounded-full cursor-pointer"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-75 ease-out"
            style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => skip(-15)}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 transition disabled:opacity-50"
            aria-label="Rewind 15s"
          >
            <SkipBack className="h-4 w-4 text-slate-700 dark:text-slate-300" />
          </button>
          <button
            onClick={togglePlay}
            disabled={loading}
            className="p-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white transition disabled:opacity-50"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button
            onClick={() => skip(15)}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 transition disabled:opacity-50"
            aria-label="Forward 15s"
          >
            <SkipForward className="h-4 w-4 text-slate-700 dark:text-slate-300" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 transition"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted || volume === 0 ? <VolumeX className="h-4 w-4 text-slate-700 dark:text-slate-300" /> : <Volume2 className="h-4 w-4 text-slate-700 dark:text-slate-300" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={muted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 h-1 bg-slate-200 dark:bg-neutral-700 rounded-full appearance-none accent-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{playbackRate}x</span>
          <select
            value={playbackRate}
            onChange={e => changeRate(parseFloat(e.target.value))}
            className="text-xs bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1 text-slate-700 dark:text-slate-300"
          >
            <option value="0.75">0.75x</option>
            <option value="1">1x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-2">
          <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
        </div>
      )}
    </div>
  )
}