import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCourse, updateCourse } from '../../lib/data'
import { useTheme } from '../../contexts/ThemeContext'
import {
  getYouTubeStatus, connectYouTube, disconnectYouTube,
  getYouTubeAccessToken, uploadToYouTube,
} from '../../lib/youtube'
import Preloader from '../../components/Preloader'
import CertificateDesigner from '../../components/CertificateDesigner'

// ---------------------------------------------------------------------------
// Cloudinary setup (free — 25 GB storage, no credit card needed)
//
// One-time setup in Cloudinary dashboard:
//   1. Sign up free at cloudinary.com
//   2. Settings → Upload → Upload presets → Add upload preset
//   3. Name it "coursepress_uploads", set Signing mode to "Unsigned" → Save
//   4. Copy your Cloud Name from the dashboard top-left
//   5. Paste it below as CLOUDINARY_CLOUD
// ---------------------------------------------------------------------------
const CLOUDINARY_CLOUD  = 'dzqpchfew'   // ← replace with your Cloudinary cloud name
const CLOUDINARY_PRESET = 'coursepress_uploads'


async function uploadToCloudinary(file) {
  const form = new FormData()
  form.append('file',           file)
  form.append('upload_preset',  CLOUDINARY_PRESET)
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`,
    { method: 'POST', body: form }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Cloudinary upload failed')
  }
  const data = await res.json()
  return data.secure_url
}

// Extract YouTube video ID for thumbnail preview
function youtubePreviewId(input) {
  if (!input) return ''
  const s = input.trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s
  const m = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/)   ||
            s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/) ||
            s.match(/\/embed\/([a-zA-Z0-9_-]{11})/)   ||
            s.match(/\/shorts\/([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : ''
}

function uid() { return Math.random().toString(36).slice(2, 9) }

// Recognize and render links in text (http(s) and www)
function linkifyToReact(text, keyPrefix = 'link') {
  if (!text) return []
  const str = String(text)
  const parts = str.split(/(https?:\/\/[^\s<>()"]+|www\.[^\s<>()"]+)/gi)
  return parts.filter(Boolean).map((part, i) => {
    const isUrl = /^(https?:\/\/|www\.)/i.test(part)
    if (!isUrl) return <span key={`${keyPrefix}-${i}`}>{part}</span>
    const href = part.startsWith('http') ? part : `https://${part}`
    return (
      <a
        key={`${keyPrefix}-${i}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    )
  })
}

function LinkifiedText({ text, className = '' }) {
  if (!text) return null
  const nodes = linkifyToReact(text, 'lt')
  return <span className={className}>{nodes}</span>
}

export default function CourseEditor() {
  const { courseId } = useParams()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [course,    setCourse]    = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [savedAt,   setSavedAt]   = useState(null)
  const [uploading, setUploading] = useState('')   // '' | 'cover' | 'resource'
  const [uploadErr, setUploadErr] = useState('')

  // ── YouTube connection state ──────────────────────────────────────────────
  const [ytConnected,  setYtConnected]  = useState(false)
  const [ytChannel,    setYtChannel]    = useState({ title: '', thumbnail: '' })
  const [ytConnecting, setYtConnecting] = useState(false)
  const [ytLoading,    setYtLoading]    = useState(true)

  // Track per-lesson video uploads: { [lessonId]: { percent, status, abort } }
  const [videoUploads, setVideoUploads] = useState({})
  const abortControllers = useRef({})

  // ── Load YouTube connection status on mount ───────────────────────────────
  useEffect(() => {
    getYouTubeStatus()
      .then(data => {
        setYtConnected(data.connected)
        if (data.connected) {
          setYtChannel({ title: data.channelTitle, thumbnail: data.channelThumbnail })
        }
      })
      .catch(() => { /* Functions URL not configured yet — that's ok */ })
      .finally(() => setYtLoading(false))
  }, [])

  useEffect(() => { getCourse(courseId).then(setCourse) }, [courseId])

  if (!course) return <Preloader label="Loading editor" />

  function set(patch) { setCourse(c => ({ ...c, ...patch })) }

  async function save() {
    setSaving(true)
    setUploadErr('')
    try {
      const { id, ...data } = course
      await updateCourse(courseId, data)
      setSavedAt(new Date())
    } catch (err) {
      setUploadErr(`Save failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Cover image ──────────────────────────────────────────────────────────
  async function handleCoverUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploadErr('')
    setUploading('cover')
    try {
      const url = await uploadToCloudinary(file)
      set({ coverImage: url })
    } catch (err) {
      setUploadErr(`Cover upload failed: ${err.message}`)
    } finally {
      setUploading('')
    }
  }

  // ── Curriculum helpers ───────────────────────────────────────────────────
  function addModule() {
    set({ curriculum: [...(course.curriculum || []), { id: uid(), title: 'New module', lessons: [] }] })
  }
  function updateModule(modId, patch) {
    set({ curriculum: course.curriculum.map(m => m.id === modId ? { ...m, ...patch } : m) })
  }
  function removeModule(modId) {
    if (!confirm('Remove this module and all its lessons?')) return
    set({ curriculum: course.curriculum.filter(m => m.id !== modId) })
  }
  function addLesson(modId, type) {
    set({
      curriculum: course.curriculum.map(m =>
        m.id !== modId ? m : {
          ...m,
          lessons: [...(m.lessons || []), {
            id: uid(), title: 'New lesson', type,
            youtubeId: '', audioUrl: '', content: '', durationMin: '', resources: [],
          }],
        }
      ),
    })
  }
  function updateLesson(modId, lessonId, patch) {
    set({
      curriculum: course.curriculum.map(m =>
        m.id !== modId ? m : {
          ...m,
          lessons: m.lessons.map(l => l.id === lessonId ? { ...l, ...patch } : l),
        }
      ),
    })
  }
  function removeLesson(modId, lessonId) {
    set({
      curriculum: course.curriculum.map(m =>
        m.id !== modId ? m : { ...m, lessons: m.lessons.filter(l => l.id !== lessonId) }
      ),
    })
  }

  // ── Downloadable resource upload ─────────────────────────────────────────
  async function uploadResource(modId, lessonId, file) {
    setUploadErr('')
    setUploading('resource')
    try {
      const url    = await uploadToCloudinary(file)
      const mod    = course.curriculum.find(m => m.id === modId)
      const lesson = mod.lessons.find(l => l.id === lessonId)
      updateLesson(modId, lessonId, {
        resources: [...(lesson.resources || []), { label: file.name, url }],
      })
    } catch (err) {
      setUploadErr(`File upload failed: ${err.message}`)
    } finally {
      setUploading('')
    }
  }

  // ── Audio upload ───────────────────────────────────────────────────────────
  async function uploadAudio(modId, lessonId, file) {
    setUploadErr('')
    setUploading('audio')
    try {
      const url = await uploadToCloudinary(file)
      updateLesson(modId, lessonId, { audioUrl: url })
    } catch (err) {
      setUploadErr(`Audio upload failed: ${err.message}`)
    } finally {
      setUploading('')
    }
  }

  // ── YouTube channel connection ────────────────────────────────────────────
  async function handleConnectYouTube() {
    setYtConnecting(true)
    setUploadErr('')
    try {
      const { channelTitle, channelThumbnail } = await connectYouTube()
      setYtConnected(true)
      setYtChannel({ title: channelTitle, thumbnail: channelThumbnail })
    } catch (err) {
      if (!err.message.includes('cancelled')) {
        setUploadErr(`YouTube connection failed: ${err.message}`)
      }
    } finally {
      setYtConnecting(false)
    }
  }

  async function handleDisconnectYouTube() {
    if (!confirm('Disconnect your YouTube channel? You can reconnect anytime.')) return
    try {
      await disconnectYouTube()
      setYtConnected(false)
      setYtChannel({ title: '', thumbnail: '' })
    } catch (err) {
      setUploadErr(`Failed to disconnect: ${err.message}`)
    }
  }

  // ── Direct video upload to YouTube ────────────────────────────────────────
  async function handleVideoUpload(modId, lessonId, file) {
    setUploadErr('')
    const lesson = course.curriculum
      .find(m => m.id === modId)?.lessons
      .find(l => l.id === lessonId)

    // Create an abort controller for this upload
    const controller = new AbortController()
    abortControllers.current[lessonId] = controller

    setVideoUploads(prev => ({
      ...prev,
      [lessonId]: { percent: 0, status: 'uploading', fileName: file.name },
    }))

    try {
      // 1. Get a fresh access token
      const accessToken = await getYouTubeAccessToken()

      // 2. Upload directly to YouTube with progress tracking
      const videoId = await uploadToYouTube(
        file,
        accessToken,
        { title: lesson?.title || file.name, description: `Course video: ${lesson?.title || ''}` },
        ({ percent }) => {
          setVideoUploads(prev => ({
            ...prev,
            [lessonId]: { ...prev[lessonId], percent, status: 'uploading' },
          }))
        },
        controller.signal,
      )

      // 3. Auto-save the YouTube video ID/URL to the lesson
      updateLesson(modId, lessonId, {
        youtubeId: `https://www.youtube.com/watch?v=${videoId}`,
      })

      setVideoUploads(prev => ({
        ...prev,
        [lessonId]: { ...prev[lessonId], percent: 100, status: 'done', videoId },
      }))
    } catch (err) {
      if (err.message === 'Upload cancelled') {
        setVideoUploads(prev => {
          const next = { ...prev }
          delete next[lessonId]
          return next
        })
      } else {
        setUploadErr(`Video upload failed: ${err.message}`)
        setVideoUploads(prev => ({
          ...prev,
          [lessonId]: { ...prev[lessonId], status: 'error', error: err.message },
        }))
      }
    } finally {
      delete abortControllers.current[lessonId]
    }
  }

  function cancelVideoUpload(lessonId) {
    abortControllers.current[lessonId]?.abort()
  }

  return (
    <div className={`min-h-screen pb-24 ${isDark ? 'bg-neutral-950 text-white' : 'bg-slate-50 text-slate-900'}`}>

      {/* Sticky save bar */}
      <header className={`sticky top-0 z-10 ${isDark ? 'bg-neutral-900 border-neutral-800 shadow-none' : 'bg-white border-b border-slate-200 shadow-sm'}`}>
        <div className="max-w-3xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link to="/admin" className="text-sm text-slate-500 hover:text-slate-800 transition">
            ← All courses
          </Link>
          <div className="flex items-center gap-3">
            {uploading && (
              <span className="text-xs text-gold font-medium animate-pulse">
                {uploading === 'cover' ? 'Uploading cover…' : uploading === 'audio' ? 'Uploading audio…' : 'Uploading file…'}
              </span>
            )}
            {Object.values(videoUploads).some(u => u.status === 'uploading') && (
              <span className="text-xs text-blue-600 font-medium animate-pulse">
                Uploading video to YouTube…
              </span>
            )}
            {uploadErr && (
              <span className="text-xs text-red-600 max-w-xs truncate">{uploadErr}</span>
            )}
            {savedAt && !saving && !uploading && (
              <span className="text-xs text-slate-400">Saved {savedAt.toLocaleTimeString()}</span>
            )}
            <button
              onClick={save}
              disabled={saving || !!uploading}
              className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-black transition disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        {/* ── Course details ── */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Course details</h2>

          <Field label="Title">
            <input value={course.title} onChange={e => set({ title: e.target.value })} className="editor-input" />
          </Field>
          <Field label="Subtitle">
            <input value={course.subtitle} onChange={e => set({ subtitle: e.target.value })} className="editor-input" />
          </Field>
          <Field label="Description">
            <textarea rows={5} value={course.description} onChange={e => set({ description: e.target.value })} className="editor-input" />
          </Field>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Field label="Price (₦)">
              <input type="number" value={course.price} onChange={e => set({ price: Number(e.target.value) })} className="editor-input" />
            </Field>
            <Field label="Cover image (Cloudinary)">
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                disabled={!!uploading}
                className="text-sm text-slate-500 file:mr-3 file:text-xs file:font-medium file:bg-slate-100 dark:file:bg-slate-700 file:border-0 file:rounded file:px-3 file:py-1.5 file:cursor-pointer disabled:opacity-50"
              />
            </Field>
          </div>
          {course.coverImage && (
            <div>
              <img src={course.coverImage} alt="" className="rounded-lg max-h-40 object-cover" />
              <p className="text-[10px] text-slate-400 mt-1 font-mono truncate">{course.coverImage}</p>
            </div>
          )}
        </section>

        {/* ── YouTube Connection ── */}
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              {/* YouTube icon */}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${ytConnected ? 'bg-red-500/10' : 'bg-slate-100'}`}>
                <svg className={`w-5 h-5 ${ytConnected ? 'text-red-600' : 'text-slate-400'}`} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {ytLoading ? 'Checking YouTube…' : ytConnected ? 'YouTube Connected' : 'YouTube Upload'}
                </p>
                {ytConnected ? (
                  <p className="text-xs text-slate-500">
                    Channel: <span className="font-medium text-slate-700">{ytChannel.title}</span>
                    <span className="text-slate-400"> · Videos upload as Unlisted · Not made for kids</span>
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Connect your YouTube channel to upload videos directly from here
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {ytConnected ? (
                <button
                  onClick={handleDisconnectYouTube}
                  className="text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={handleConnectYouTube}
                  disabled={ytConnecting || ytLoading}
                  className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg px-4 py-2 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {ytConnecting ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Connecting…
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Connect YouTube Channel
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── Curriculum ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Curriculum</h2>
            <button onClick={addModule} className="text-sm font-medium text-goldDeep hover:underline">
              + Add module
            </button>
          </div>

          <div className="space-y-4">
            {(course.curriculum || []).map((mod, mi) => (
              <div key={mod.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">

                {/* Module header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <span className="font-mono text-xs text-slate-400 font-medium shrink-0">M{mi + 1}</span>
                  <input
                    value={mod.title}
                    onChange={e => updateModule(mod.id, { title: e.target.value })}
                    className="flex-1 bg-transparent text-sm font-semibold text-slate-800 focus:outline-none"
                    placeholder="Module title…"
                  />
                  <button onClick={() => removeModule(mod.id)} className="text-xs text-red-500 hover:text-red-700 shrink-0">
                    Remove
                  </button>
                </div>

                {/* Module title link preview */}
                {mod.title && /^(https?:\/\/|www\.)/i.test(mod.title.trim()) && (
                  <div className="px-4 py-2 border-b border-slate-100 bg-white">
                    <LinkifiedText text={mod.title} className="text-xs text-slate-600 break-all" />
                  </div>
                )}

                {/* Lessons */}
                <div className="p-4 space-y-3">
                  {(mod.lessons || []).map((lesson, li) => {
                    const previewId = youtubePreviewId(lesson.youtubeId)
                    return (
                      <div key={lesson.id} className="border border-slate-200 rounded-lg p-3 space-y-2.5 bg-slate-50/50">

                        {/* Lesson header */}
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-400 shrink-0 font-medium">
                            {mi + 1}.{li + 1}
                          </span>
                          <input
                            value={lesson.title}
                            onChange={e => updateLesson(mod.id, lesson.id, { title: e.target.value })}
                            className="flex-1 text-sm font-medium text-slate-800 focus:outline-none bg-transparent border-b border-transparent focus:border-slate-300 pb-0.5"
                            placeholder="Lesson title…"
                          />
<span className={`text-[10px] font-mono px-2 py-0.5 rounded font-medium shrink-0
                             ${lesson.type === 'video' ? 'bg-blue-50 text-blue-600' : lesson.type === 'audio' ? 'bg-purple-50 text-purple-600' : 'bg-amber-50 text-amber-700'}`}>
                             {lesson.type}
                           </span>
                          <button
                            onClick={() => removeLesson(mod.id, lesson.id)}
                            className="text-slate-400 hover:text-red-500 transition text-xs shrink-0"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Lesson title link preview */}
                        {lesson.title && /^(https?:\/\/|www\.)/i.test(lesson.title.trim()) && (
                          <div className="text-xs text-slate-600 break-all">
                            <LinkifiedText text={lesson.title} />
                          </div>
                        )}

{/* Video: Direct upload OR YouTube URL + thumbnail preview */}
                         {lesson.type === 'video' && (() => {
                           const upload = videoUploads[lesson.id]
                           const isUploading = upload?.status === 'uploading'
                           const uploadDone  = upload?.status === 'done'
                           const uploadError = upload?.status === 'error'
                           return (
                           <div className="space-y-2.5">

                             {/* Upload progress bar */}
                             {isUploading && (
                               <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                                 <div className="flex items-center justify-between">
                                   <div className="flex items-center gap-2">
                                     <svg className="w-4 h-4 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                     </svg>
                                     <span className="text-xs font-medium text-blue-700">
                                       Uploading to YouTube… {upload.percent}%
                                     </span>
                                   </div>
                                   <button
                                     onClick={() => cancelVideoUpload(lesson.id)}
                                     className="text-xs text-red-500 hover:text-red-700 font-medium"
                                   >
                                     Cancel
                                   </button>
                                 </div>
                                 <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                                   <div
                                     className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                                     style={{ width: `${upload.percent}%` }}
                                   />
                                 </div>
                                 <p className="text-[10px] text-blue-500 truncate">{upload.fileName}</p>
                               </div>
                             )}

                             {/* Upload success */}
                             {uploadDone && (
                               <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                                 <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                 </svg>
                                 <span className="text-xs font-medium text-emerald-700">
                                   Video uploaded successfully!
                                 </span>
                               </div>
                             )}

                             {/* Upload error */}
                             {uploadError && (
                               <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-2.5">
                                 <span className="text-xs font-medium text-red-600">{upload.error}</span>
                               </div>
                             )}

                             {/* Direct upload button (shown when YouTube is connected and not uploading) */}
                             {ytConnected && !isUploading && !previewId && (
                               <label className="group flex items-center justify-center gap-2 border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-lg px-4 py-4 cursor-pointer bg-blue-50/50 hover:bg-blue-50 transition">
                                 <svg className="w-5 h-5 text-blue-500 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                 </svg>
                                 <span className="text-xs font-semibold text-blue-600 group-hover:text-blue-700">
                                   Upload video directly to YouTube
                                 </span>
                                 <input
                                   type="file"
                                   accept="video/*"
                                   className="hidden"
                                   onChange={e => {
                                     const file = e.target.files[0]
                                     if (file) handleVideoUpload(mod.id, lesson.id, file)
                                     e.target.value = ''
                                   }}
                                 />
                               </label>
                             )}

                             {/* OR divider (when YouTube is connected) */}
                             {ytConnected && !isUploading && !previewId && (
                               <div className="flex items-center gap-3">
                                 <div className="flex-1 h-px bg-slate-200" />
                                 <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">or paste URL</span>
                                 <div className="flex-1 h-px bg-slate-200" />
                               </div>
                             )}

                             {/* YouTube URL input (always available) */}
                             {!isUploading && (
                               <input
                                 placeholder={ytConnected
                                   ? 'Paste YouTube URL (optional if uploading directly)'
                                   : 'Paste YouTube URL — e.g. https://www.youtube.com/watch?v=xxxx (set to Unlisted)'}
                                 value={lesson.youtubeId}
                                 onChange={e => updateLesson(mod.id, lesson.id, { youtubeId: e.target.value })}
                                 className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-goldDeep bg-white"
                               />
                             )}

                             {/* Thumbnail preview */}
                             {previewId && (
                               <div className="flex items-center gap-3 bg-white rounded-lg p-2 border border-slate-100">
                                 <img
                                   src={`https://img.youtube.com/vi/${previewId}/mqdefault.jpg`}
                                   alt=""
                                   className="w-20 h-14 object-cover rounded shrink-0"
                                   onError={e => { e.target.style.display = 'none' }}
                                 />
                                 <div>
                                   <p className="text-xs font-medium text-slate-600">✓ Video detected</p>
                                   <p className="font-mono text-[10px] text-slate-400 mt-0.5">{previewId}</p>
                                 </div>
                                 {/* Replace button: allow uploading a new video even when one exists */}
                                 {ytConnected && (
                                   <label className="ml-auto text-[10px] font-medium text-blue-600 hover:underline cursor-pointer shrink-0">
                                     Replace
                                     <input
                                       type="file"
                                       accept="video/*"
                                       className="hidden"
                                       onChange={e => {
                                         const file = e.target.files[0]
                                         if (file) handleVideoUpload(mod.id, lesson.id, file)
                                         e.target.value = ''
                                       }}
                                     />
                                   </label>
                                 )}
                               </div>
                             )}
                           </div>
                           )
                         })()}

                         {/* Audio: Upload audio file */}
                         {lesson.type === 'audio' && (
                           <div className="space-y-2">
                             {lesson.audioUrl ? (
                               <div className="flex items-center gap-3 bg-white rounded-lg p-2 border border-slate-100">
                                 <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                                   <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                                 </div>
                                 <div className="flex-1 min-w-0">
                                   <p className="text-xs font-medium text-slate-600">Audio uploaded</p>
                                   <p className="font-mono text-[10px] text-slate-400 truncate">{lesson.audioUrl}</p>
                                 </div>
                               </div>
                             ) : (
                               <p className="text-xs text-slate-500">No audio uploaded yet</p>
                             )}
                             <label className={`text-xs font-medium cursor-pointer flex items-center gap-2
                               ${uploading ? 'text-slate-400 cursor-not-allowed' : 'text-purple-600 hover:underline'}`}>
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                               Upload audio (MP3, WAV, etc)
                               <input
                                 type="file"
                                 accept="audio/*"
                                 className="hidden"
                                 disabled={!!uploading}
                                 onChange={e => e.target.files[0] && uploadAudio(mod.id, lesson.id, e.target.files[0])}
                               />
                             </label>
                           </div>
                         )}

                         {/* Text: content textarea */}
                        {lesson.type === 'text' && (
                          <>
                            <textarea
                              rows={5}
                              placeholder="Lesson text content…"
                              value={lesson.content}
                              onChange={e => updateLesson(mod.id, lesson.id, { content: e.target.value })}
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-goldDeep bg-white resize-none"
                            />
                            {lesson.content && (
                              <div className="text-sm text-slate-700 bg-white border border-slate-100 rounded p-2 whitespace-pre-wrap break-words">
                                <LinkifiedText text={lesson.content} />
                              </div>
                            )}
                          </>
                        )}

                        {/* Duration + downloadable attachment */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <input
                            type="number"
                            placeholder="Duration (min)"
                            value={lesson.durationMin}
                            onChange={e => updateLesson(mod.id, lesson.id, { durationMin: e.target.value })}
                            className="w-32 text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-goldDeep bg-white"
                          />
                          <label className={`text-xs font-medium cursor-pointer
                            ${uploading ? 'text-slate-400 cursor-not-allowed' : 'text-goldDeep hover:underline'}`}>
                            + Attach download (PDF, etc)
                            <input
                              type="file"
                              className="hidden"
                              disabled={!!uploading}
                              onChange={e => e.target.files[0] && uploadResource(mod.id, lesson.id, e.target.files[0])}
                            />
                          </label>
                        </div>

                        {/* Attached resources list */}
                        {!!lesson.resources?.length && (
                          <ul className="space-y-1 pt-1">
                            {lesson.resources.map((r, i) => (
                              <li key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
                                <span>📎</span>
                                <a href={r.url} target="_blank" rel="noreferrer" className="hover:underline truncate">
                                  {r.label}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )
                  })}

                  <div className="flex gap-4 pt-1">
                    <button onClick={() => addLesson(mod.id, 'video')} className="text-xs font-medium text-blue-600 hover:underline">
                      + Video lesson
                    </button>
                    <button onClick={() => addLesson(mod.id, 'audio')} className="text-xs font-medium text-purple-600 hover:underline">
                      + Audio lesson
                    </button>
                    <button onClick={() => addLesson(mod.id, 'text')} className="text-xs font-medium text-amber-600 hover:underline">
                      + Text lesson
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <CertificateDesigner
          value={course.certificate}
          onChange={certificate => set({ certificate })}
          upload={uploadToCloudinary}
        />
      </main>

      <style>{`
        .editor-input {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          background: #f8fafc;
          color: #0f172a;
          outline: none;
          transition: border-color 0.15s, background 0.15s;
        }
        .editor-input:focus { border-color: #c97f1e; background: #fff; }
      `}</style>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  )
}
