import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Undo2, Redo2, Plus, Play, X, Check, Loader2,
  AlertTriangle, Send, CheckCircle2, GripVertical,
  Cloud, Sparkles, Smartphone, RotateCcw, RefreshCw,
} from 'lucide-react'
import { getCourse, updateCourse, subscribeCourse } from '../../lib/data'
import { useTheme } from '../../contexts/ThemeContext'
import { useToast } from '../../contexts/ToastContext'
import {
  getYouTubeStatus, connectYouTube, refreshYouTubeSession, disconnectYouTube,
  getYouTubeAccessToken, uploadToYouTube, preloadGsi, isYouTubeTokenValid,
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

// ── Array Reordering Helpers for Drag and Drop ─────────────────────────────
function moveArrayItem(array, fromIndex, toIndex, position = 'after') {
  if (fromIndex === toIndex && (position === 'before' || position === 'after')) {
    return array
  }
  const result = Array.from(array)
  const [item] = result.splice(fromIndex, 1)

  let targetIdx = toIndex
  if (fromIndex < toIndex) {
    targetIdx -= 1
  }

  let insertIdx = position === 'before' ? targetIdx : targetIdx + 1
  insertIdx = Math.max(0, Math.min(insertIdx, result.length))
  result.splice(insertIdx, 0, item)
  return result
}

function moveLessonAcrossModules(curriculum, fromModIndex, fromLessonIndex, toModIndex, toLessonIndex, position = 'after') {
  const newCurriculum = curriculum.map(m => ({
    ...m,
    lessons: [...(m.lessons || [])],
  }))

  const sourceLessons = newCurriculum[fromModIndex]?.lessons
  if (!sourceLessons || !sourceLessons[fromLessonIndex]) return curriculum
  const [movingLesson] = sourceLessons.splice(fromLessonIndex, 1)

  const targetLessons = newCurriculum[toModIndex].lessons
  let insertIdx = position === 'before' ? toLessonIndex : toLessonIndex + 1
  insertIdx = Math.max(0, Math.min(insertIdx, targetLessons.length))
  targetLessons.splice(insertIdx, 0, movingLesson)

  return newCurriculum
}

function appendLessonToModule(curriculum, fromModIndex, fromLessonIndex, toModIndex) {
  if (fromModIndex === toModIndex) return curriculum
  const newCurriculum = curriculum.map(m => ({
    ...m,
    lessons: [...(m.lessons || [])],
  }))
  const sourceLessons = newCurriculum[fromModIndex]?.lessons
  if (!sourceLessons || !sourceLessons[fromLessonIndex]) return curriculum
  const [movingLesson] = sourceLessons.splice(fromLessonIndex, 1)
  newCurriculum[toModIndex].lessons.push(movingLesson)
  return newCurriculum
}

export default function CourseEditor() {
  const { courseId } = useParams()
  const { theme } = useTheme()
  const toast = useToast()
  const navigate = useNavigate()
  const isDark = theme === 'dark'

  // Unique client/device session identifier
  const clientId = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'dev_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now()
  )

  const [course,          setCourse]          = useState(null)
  const [saving,          setSaving]          = useState(false)
  const [publishing,      setPublishing]      = useState(false)
  const [savedAt,         setSavedAt]         = useState(null)
  const [hasUnpublished,  setHasUnpublished]  = useState(false)
  const [syncNotice,      setSyncNotice]      = useState('')   // subtle cross-device notification
  const [uploading,       setUploading]       = useState('')   // '' | 'cover' | 'resource' | 'audio'
  const [uploadErr,       setUploadErr]       = useState('')

  // ── History (Undo / Redo) state ──────────────────────────────────────────
  const [past,   setPast]   = useState([])
  const [future, setFuture] = useState([])

  // ── Video Preview Modal state ─────────────────────────────────────────────
  const [previewModalVideo, setPreviewModalVideo] = useState(null) // { youtubeId, title }

  // ── Confirmation Modal & Exit Prompt Modal states ────────────────────────
  const [confirmDialog,   setConfirmDialog]   = useState(null) // { title, message, details, confirmLabel, cancelLabel, confirmVariant, onConfirm, isAlert }
  const [exitPromptOpen,  setExitPromptOpen]  = useState(false)

  // ── Drag & Drop state (for reordering modules & sub-modules) ──────────────
  const [dragItem,     setDragItem]     = useState(null) // { type: 'module', index, id } | { type: 'lesson', modIndex, lessonIndex, id }
  const [dragOver,     setDragOver]     = useState(null) // { type, index/modIndex, lessonIndex?, position }
  const activeGripRef                   = useRef(null)   // id of module or lesson whose handle is being grabbed

  // ── Auto-save & Local Draft refs ──────────────────────────────────────────
  const courseRef             = useRef(null)
  const autoSaveTimer         = useRef(null)
  const hasUnpublishedRef     = useRef(false)
  const savingRef             = useRef(false)
  const lastLocalSaveTimeRef  = useRef(0)
  const lastRemoteSavedAtRef  = useRef(0)
  const isInitialLoadRef      = useRef(true)

  // Keep courseRef updated
  useEffect(() => {
    courseRef.current = course
  }, [course])

  // ── YouTube connection state ──────────────────────────────────────────────
  const [ytConnected,  setYtConnected]  = useState(false)
  const [ytTokenValid, setYtTokenValid] = useState(false)
  const [ytChannel,    setYtChannel]    = useState({ title: '', thumbnail: '' })
  const [ytConnecting, setYtConnecting] = useState(false)
  const [ytLoading,    setYtLoading]    = useState(true)
  const [ytError,      setYtError]      = useState('')

  // Track per-lesson video uploads: { [lessonId]: { percent, loaded, total, status, fileName, file, uploadUrl, error, isNetworkError } }
  const [videoUploads, setVideoUploads] = useState({})
  const abortControllers = useRef({})
  const uploadSessionsRef = useRef({})

  // ── Preload Google Identity Services & sync YouTube connection status ─────
  const syncYouTubeStatus = useCallback(() => {
    return getYouTubeStatus()
      .then(data => {
        setYtConnected(data.connected)
        setYtTokenValid(Boolean(data.tokenValid))
        if (data.connected) {
          setYtChannel({ title: data.channelTitle, thumbnail: data.channelThumbnail })
        } else {
          setYtChannel({ title: '', thumbnail: '' })
        }
      })
      .catch(err => {
        setYtError(err?.message || 'Unable to read YouTube connection status.')
      })
  }, [])

  useEffect(() => {
    preloadGsi()
    syncYouTubeStatus().finally(() => setYtLoading(false))

    const interval = window.setInterval(() => {
      setYtTokenValid(isYouTubeTokenValid())
    }, 30000)

    const onFocusOrStorage = () => {
      syncYouTubeStatus()
    }
    window.addEventListener('focus', onFocusOrStorage)
    window.addEventListener('storage', onFocusOrStorage)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocusOrStorage)
      window.removeEventListener('storage', onFocusOrStorage)
    }
  }, [syncYouTubeStatus])

  // ── Auto-save Draft to Firestore & LocalStorage (Never pushes to live students) ─
  const autoSaveDraft = useCallback(async () => {
    const current = courseRef.current
    if (!current || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    const saveTime = Date.now()
    lastLocalSaveTimeRef.current = saveTime
    try {
      const { id, draft, hasUnpublishedChanges, draftSavedAt, draftDeviceId, lastPublishedAt, ...draftFields } = current
      await updateCourse(courseId, {
        draft: draftFields,
        hasUnpublishedChanges: true,
        draftSavedAt: saveTime,
        draftDeviceId: clientId.current,
      })
      lastRemoteSavedAtRef.current = saveTime
      setSavedAt(new Date(saveTime))
      setHasUnpublished(true)
      hasUnpublishedRef.current = true
    } catch (err) {
      console.error('Draft auto-save failed:', err)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [courseId])

  // ── Publish Draft for Students (Pushes live to students) ───────────────────
  const publishForStudents = useCallback(async (options = { showNotification: true }) => {
    const current = courseRef.current
    if (!current || savingRef.current) return false
    savingRef.current = true
    setPublishing(true)
    setUploadErr('')
    try {
      const { id, draft, hasUnpublishedChanges, draftSavedAt, draftDeviceId, ...liveData } = current
      await updateCourse(courseId, {
        ...liveData,
        draft: null,
        hasUnpublishedChanges: false,
        lastPublishedAt: new Date().toISOString(),
      })
      try {
        localStorage.removeItem(`cp_draft_${courseId}`)
      } catch {}
      setHasUnpublished(false)
      hasUnpublishedRef.current = false
      setSavedAt(new Date())
      if (options.showNotification) {
        toast('Course published! Changes are now live for students.', 'success')
      }
      return true
    } catch (err) {
      console.error('Publish failed:', err)
      setUploadErr(`Publish failed: ${err.message}`)
      if (options.showNotification) {
        toast(`Publish failed: ${err.message}`, 'error')
      }
      return false
    } finally {
      savingRef.current = false
      setPublishing(false)
    }
  }, [courseId, toast])

  // ── Real-Time Cross-Device Course Sync ────────────────────────────────────
  useEffect(() => {
    // Check for any post-reload or post-navigation toast notifications
    try {
      const pending = sessionStorage.getItem('cp_post_route_toast')
      if (pending) {
        sessionStorage.removeItem('cp_post_route_toast')
        const { message, type } = JSON.parse(pending)
        toast(message, type || 'info')
      }
    } catch {}

    const unsubscribe = subscribeCourse(
      courseId,
      (remoteCourse) => {
        if (!remoteCourse) return

        const remoteDraftSavedAt = typeof remoteCourse.draftSavedAt === 'string'
          ? new Date(remoteCourse.draftSavedAt).getTime()
          : (Number(remoteCourse.draftSavedAt) || 0)

        // 1. Initial Load: prioritize cloud draft so work done on other devices loads immediately
        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false
          let initialData = { ...remoteCourse }
          let isUnpublished = !!remoteCourse.hasUnpublishedChanges

          if (remoteCourse.draft) {
            initialData = { ...remoteCourse, ...remoteCourse.draft }
            isUnpublished = true
            lastRemoteSavedAtRef.current = remoteDraftSavedAt
          }

          // Check if device-local storage has an unsaved offline draft
          try {
            const draftRaw = localStorage.getItem(`cp_draft_${courseId}`)
            if (draftRaw) {
              const localDraft = JSON.parse(draftRaw)
              const localDraftTime = Number(localDraft?._draftSavedAt) || 0
              if (localDraft && localDraft.title !== undefined) {
                // Cloud draft wins unless local draft is strictly newer (e.g. offline edits)
                if (!remoteCourse.draft || localDraftTime > remoteDraftSavedAt) {
                  initialData = { ...initialData, ...localDraft }
                  isUnpublished = true
                  if (localDraftTime > remoteDraftSavedAt) {
                    setTimeout(() => autoSaveDraft(), 1000)
                  }
                }
              }
            }
          } catch {}

          setCourse(initialData)
          courseRef.current = initialData
          setHasUnpublished(isUnpublished)
          hasUnpublishedRef.current = isUnpublished
          return
        }

        // 2. Real-Time incoming updates while editor is open:

        // Check if write originated from THIS device or is a pending local write
        if (remoteCourse.draftDeviceId === clientId.current || remoteCourse._hasPendingWrites) {
          if (remoteDraftSavedAt > lastRemoteSavedAtRef.current) {
            lastRemoteSavedAtRef.current = remoteDraftSavedAt
          }
          return
        }

        // Case A: Another device updated the draft in real time!
        if (remoteCourse.draft && remoteDraftSavedAt > lastRemoteSavedAtRef.current) {
          // If we have newer unsaved local edits, don't overwrite
          if (lastLocalSaveTimeRef.current > remoteDraftSavedAt) {
            return
          }

          lastRemoteSavedAtRef.current = remoteDraftSavedAt
          const merged = { ...remoteCourse, ...remoteCourse.draft }
          setCourse(merged)
          courseRef.current = merged
          setHasUnpublished(true)
          hasUnpublishedRef.current = true
          setSavedAt(new Date(remoteDraftSavedAt))

          try {
            localStorage.setItem(`cp_draft_${courseId}`, JSON.stringify({
              ...remoteCourse.draft,
              _draftSavedAt: remoteDraftSavedAt,
              _draftDeviceId: remoteCourse.draftDeviceId || 'other_device',
            }))
          } catch {}

          setSyncNotice('Changes from your other device synced in real time')
          setTimeout(() => setSyncNotice(''), 4500)
          return
        }

        // Case B: Another device published the course live for students
        if (!remoteCourse.hasUnpublishedChanges && !remoteCourse.draft) {
          lastRemoteSavedAtRef.current = remoteDraftSavedAt
          setCourse(remoteCourse)
          courseRef.current = remoteCourse
          setHasUnpublished(false)
          hasUnpublishedRef.current = false
          setSavedAt(new Date())

          try {
            localStorage.removeItem(`cp_draft_${courseId}`)
          } catch {}

          setSyncNotice('Course published for students from another device')
          setTimeout(() => setSyncNotice(''), 4500)
          return
        }
      },
      (err) => {
        console.error('Real-time course sync subscription error:', err)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [courseId, autoSaveDraft, toast])

  // ── Mutate course state with Undo tracking & debounced Auto-save ──────────
  const set = useCallback((patch, recordHistory = true, immediate = false) => {
    setCourse(prev => {
      if (!prev) return prev
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }

      if (recordHistory) {
        setPast(p => [...p.slice(-29), prev])
        setFuture([])
      }
      setHasUnpublished(true)
      hasUnpublishedRef.current = true
      courseRef.current = next

      const now = Date.now()
      lastLocalSaveTimeRef.current = now

      try {
        const { id, draft, hasUnpublishedChanges, draftSavedAt, draftDeviceId, lastPublishedAt, ...draftFields } = next
        localStorage.setItem(`cp_draft_${courseId}`, JSON.stringify({
          ...draftFields,
          _draftSavedAt: now,
          _draftDeviceId: clientId.current,
        }))
      } catch {}

      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = setTimeout(() => {
        autoSaveDraft()
      }, immediate ? 250 : 1200)

      return next
    })
  }, [courseId, autoSaveDraft])

  // ── Auto-save immediately when user switches tabs or apps (e.g. mobile to laptop) ─
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && hasUnpublishedRef.current) {
        if (autoSaveTimer.current) {
          clearTimeout(autoSaveTimer.current)
          autoSaveTimer.current = null
        }
        autoSaveDraft()
      }
    }
    const handleWindowBlur = () => {
      if (hasUnpublishedRef.current) {
        if (autoSaveTimer.current) {
          clearTimeout(autoSaveTimer.current)
          autoSaveTimer.current = null
        }
        autoSaveDraft()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [autoSaveDraft])

  // ── Undo & Redo ────────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    setPast(prevPast => {
      if (!prevPast.length || !courseRef.current) return prevPast
      const previous = prevPast[prevPast.length - 1]
      const newPast = prevPast.slice(0, -1)

      setFuture(prevFuture => [courseRef.current, ...prevFuture])
      setCourse(previous)
      courseRef.current = previous
      setHasUnpublished(true)
      hasUnpublishedRef.current = true

      const now = Date.now()
      lastLocalSaveTimeRef.current = now

      try {
        const { id, draft, hasUnpublishedChanges, draftSavedAt, draftDeviceId, lastPublishedAt, ...draftFields } = previous
        localStorage.setItem(`cp_draft_${courseId}`, JSON.stringify({
          ...draftFields,
          _draftSavedAt: now,
          _draftDeviceId: clientId.current,
        }))
      } catch {}

      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = setTimeout(() => autoSaveDraft(), 250)

      return newPast
    })
  }, [courseId, autoSaveDraft])

  const redo = useCallback(() => {
    setFuture(prevFuture => {
      if (!prevFuture.length || !courseRef.current) return prevFuture
      const next = prevFuture[0]
      const newFuture = prevFuture.slice(1)

      setPast(prevPast => [...prevPast.slice(-29), courseRef.current])
      setCourse(next)
      courseRef.current = next
      setHasUnpublished(true)
      hasUnpublishedRef.current = true

      const now = Date.now()
      lastLocalSaveTimeRef.current = now

      try {
        const { id, draft, hasUnpublishedChanges, draftSavedAt, draftDeviceId, lastPublishedAt, ...draftFields } = next
        localStorage.setItem(`cp_draft_${courseId}`, JSON.stringify({
          ...draftFields,
          _draftSavedAt: now,
          _draftDeviceId: clientId.current,
        }))
      } catch {}

      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = setTimeout(() => autoSaveDraft(), 250)

      return newFuture
    })
  }, [courseId, autoSaveDraft])

  // ── Auto-save on exit, page close or component unmount ─────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnpublishedRef.current && courseRef.current) {
        try {
          const { id, draft, hasUnpublishedChanges, draftSavedAt, draftDeviceId, lastPublishedAt, ...draftFields } = courseRef.current
          localStorage.setItem(`cp_draft_${courseId}`, JSON.stringify({
            ...draftFields,
            _draftSavedAt: Date.now(),
            _draftDeviceId: clientId.current,
          }))
        } catch {}
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return e.returnValue
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      if (hasUnpublishedRef.current && courseRef.current) {
        const { id, draft, hasUnpublishedChanges, draftSavedAt, draftDeviceId, lastPublishedAt, ...draftFields } = courseRef.current
        updateCourse(courseId, {
          draft: draftFields,
          hasUnpublishedChanges: true,
          draftSavedAt: Date.now(),
          draftDeviceId: clientId.current,
        }).catch(() => {})
      }
    }
  }, [courseId])

  // ── Intercept browser navigation / popstate when unpublished changes exist ─
  useEffect(() => {
    window.history.pushState({ cpEditor: true }, '')

    const handlePopState = () => {
      if (hasUnpublishedRef.current) {
        // Keep URL on editor and bring up exit prompt modal
        window.history.pushState({ cpEditor: true }, '')
        setExitPromptOpen(true)
      } else {
        navigate('/admin')
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [navigate])

  // ── Navigation handlers (Exit prompt & Post-route toast) ───────────────────
  const handleBackClick = (e) => {
    if (e) e.preventDefault()
    if (hasUnpublishedRef.current) {
      setExitPromptOpen(true)
    } else {
      try {
        sessionStorage.setItem('cp_post_route_toast', JSON.stringify({
          message: 'All changes are up to date.',
          type: 'ok',
        }))
      } catch {}
      navigate('/admin')
    }
  }

  const handleExitPublish = async () => {
    setExitPromptOpen(false)
    const ok = await publishForStudents({ showNotification: false })
    try {
      sessionStorage.setItem('cp_post_route_toast', JSON.stringify({
        message: ok ? 'Course published for students!' : 'Could not publish course. Kept as draft.',
        type: ok ? 'ok' : 'error',
      }))
    } catch {}
    navigate('/admin')
  }

  const handleExitDraft = () => {
    setExitPromptOpen(false)
    if (courseRef.current) {
      const { id, draft, hasUnpublishedChanges, draftSavedAt, draftDeviceId, lastPublishedAt, ...draftFields } = courseRef.current
      const now = Date.now()
      updateCourse(courseId, {
        draft: draftFields,
        hasUnpublishedChanges: true,
        draftSavedAt: now,
        draftDeviceId: clientId.current,
      }).catch(() => {})
    }
    try {
      sessionStorage.setItem('cp_post_route_toast', JSON.stringify({
        message: 'Course draft saved automatically across your devices.',
        type: 'ok',
      }))
    } catch {}
    navigate('/admin')
  }

  const handleExitWithoutSaving = async () => {
    setExitPromptOpen(false)
    hasUnpublishedRef.current = false
    setHasUnpublished(false)
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)

    // 1. Remove draft from localStorage
    try {
      localStorage.removeItem(`cp_draft_${courseId}`)
    } catch {}

    // 2. Wipe draft in Firestore so it falls back to live published data (matching Course Player)
    try {
      await updateCourse(courseId, {
        draft: null,
        hasUnpublishedChanges: false,
      })
    } catch (err) {
      console.error('Failed to clear draft:', err)
    }

    // 3. Store toast message to show after reload
    try {
      sessionStorage.setItem('cp_post_route_toast', JSON.stringify({
        message: 'Unsaved draft discarded. Course reset to live version (Course Player).',
        type: 'info',
      }))
    } catch {}

    // 4. Refresh course editor page to reload directly from live published course
    window.location.reload()
  }

  // ── Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Escape) ─────────────
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        if (previewModalVideo) {
          setPreviewModalVideo(null)
          return
        }
        if (confirmDialog) {
          setConfirmDialog(null)
          return
        }
        if (exitPromptOpen) {
          setExitPromptOpen(false)
          return
        }
      }

      // Ignore when focused in text inputs to allow native text editing
      const tag = document.activeElement?.tagName?.toLowerCase()
      const isTextInput = tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable
      if (isTextInput) return

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault()
          redo()
        } else {
          e.preventDefault()
          undo()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewModalVideo, confirmDialog, exitPromptOpen, undo, redo])

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
    set({ curriculum: [...(course.curriculum || []), { id: uid(), title: 'New module', lessons: [] }] }, true, true)
  }
  function updateModule(modId, patch) {
    set({ curriculum: course.curriculum.map(m => m.id === modId ? { ...m, ...patch } : m) })
  }
  function removeModule(modId) {
    set({ curriculum: course.curriculum.filter(m => m.id !== modId) }, true, true)
  }
  function confirmRemoveModule(mod) {
    const count = mod.lessons?.length || 0
    setConfirmDialog({
      title: 'Delete module?',
      message: `Are you sure you want to delete "${mod.title || 'Untitled module'}"?`,
      details: count > 0 ? `This will also delete all ${count} lesson${count === 1 ? '' : 's'} inside this module.` : undefined,
      confirmLabel: 'Delete module',
      confirmVariant: 'danger',
      onConfirm: () => {
        removeModule(mod.id)
        setConfirmDialog(null)
      },
    })
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
    }, true, true)
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
    }, true, true)
  }
  function confirmRemoveLesson(modId, lesson) {
    setConfirmDialog({
      title: 'Delete lesson?',
      message: `Are you sure you want to delete "${lesson.title || 'Untitled lesson'}"?`,
      details: 'This will remove the lesson and its attached media from this course.',
      confirmLabel: 'Delete lesson',
      confirmVariant: 'danger',
      onConfirm: () => {
        removeLesson(modId, lesson.id)
        setConfirmDialog(null)
      },
    })
  }

  // ── Drag and Drop Reordering Handlers ─────────────────────────────────────
  const handleDragEnd = useCallback(() => {
    activeGripRef.current = null
    setDragItem(null)
    setDragOver(null)
  }, [])

  useEffect(() => {
    const onWindowDragEnd = () => handleDragEnd()
    window.addEventListener('dragend', onWindowDragEnd)
    return () => window.removeEventListener('dragend', onWindowDragEnd)
  }, [handleDragEnd])

  const handleModuleDragStart = (e, index, modId) => {
    e.dataTransfer.setData('text/plain', modId)
    e.dataTransfer.effectAllowed = 'move'
    setDragItem({ type: 'module', index, id: modId })
  }

  const handleModuleDragOver = (e, targetIndex) => {
    e.preventDefault()
    if (!dragItem || dragItem.type !== 'module') return
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const position = e.clientY < midY ? 'before' : 'after'
    setDragOver({ type: 'module', index: targetIndex, position })
  }

  const handleModuleDrop = (e, targetIndex) => {
    e.preventDefault()
    if (!dragItem || dragItem.type !== 'module') return
    const fromIndex = dragItem.index
    const position = dragOver?.position || 'after'
    handleDragEnd()

    if (fromIndex === targetIndex && (position === 'before' || position === 'after')) return

    const newCurriculum = moveArrayItem(course.curriculum || [], fromIndex, targetIndex, position)
    if (newCurriculum !== course.curriculum) {
      set({ curriculum: newCurriculum }, true, true)
      toast('Modules rearranged', 'info')
    }
  }

  const handleLessonDragStart = (e, modIndex, lessonIndex, lessonId) => {
    e.stopPropagation()
    e.dataTransfer.setData('text/plain', lessonId)
    e.dataTransfer.effectAllowed = 'move'
    setDragItem({ type: 'lesson', modIndex, lessonIndex, id: lessonId })
  }

  const handleLessonDragOver = (e, targetModIndex, targetLessonIndex) => {
    e.preventDefault()
    e.stopPropagation()
    if (!dragItem || dragItem.type !== 'lesson') return
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const position = e.clientY < midY ? 'before' : 'after'
    setDragOver({ type: 'lesson', modIndex: targetModIndex, lessonIndex: targetLessonIndex, position })
  }

  const handleLessonDrop = (e, targetModIndex, targetLessonIndex) => {
    e.preventDefault()
    e.stopPropagation()
    if (!dragItem || dragItem.type !== 'lesson') return
    const { modIndex: fromModIndex, lessonIndex: fromLessonIndex } = dragItem
    const position = dragOver?.position || 'after'
    handleDragEnd()

    let newCurriculum
    if (fromModIndex === targetModIndex) {
      if (fromLessonIndex === targetLessonIndex && (position === 'before' || position === 'after')) return
      newCurriculum = course.curriculum.map((m, idx) => {
        if (idx !== fromModIndex) return m
        return {
          ...m,
          lessons: moveArrayItem(m.lessons || [], fromLessonIndex, targetLessonIndex, position),
        }
      })
    } else {
      newCurriculum = moveLessonAcrossModules(
        course.curriculum || [],
        fromModIndex,
        fromLessonIndex,
        targetModIndex,
        targetLessonIndex,
        position
      )
    }

    if (newCurriculum) {
      set({ curriculum: newCurriculum }, true, true)
      toast('Lessons rearranged', 'info')
    }
  }

  const handleModuleDropZone = (e, targetModIndex) => {
    e.preventDefault()
    if (!dragItem || dragItem.type !== 'lesson') return
    const { modIndex: fromModIndex, lessonIndex: fromLessonIndex } = dragItem
    handleDragEnd()

    if (fromModIndex === targetModIndex) return

    const newCurriculum = appendLessonToModule(course.curriculum || [], fromModIndex, fromLessonIndex, targetModIndex)
    if (newCurriculum) {
      set({ curriculum: newCurriculum }, true, true)
      toast('Lesson moved to module', 'info')
    }
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
    setYtError('')
    setUploadErr('')
    try {
      const { channelTitle, channelThumbnail } = await connectYouTube()
      setYtConnected(true)
      setYtTokenValid(true)
      setYtChannel({ title: channelTitle, thumbnail: channelThumbnail })
      toast(`Connected to YouTube channel: ${channelTitle}`, 'success')
    } catch (err) {
      const msg = err?.message || 'Unable to connect YouTube account. Please try again.'
      setYtError(msg)
      setUploadErr(`YouTube connection failed: ${msg}`)
      toast(msg, 'error')
      syncYouTubeStatus()
    } finally {
      setYtConnecting(false)
    }
  }

  async function handleRefreshYouTube() {
    setYtConnecting(true)
    setYtError('')
    setUploadErr('')
    try {
      const { channelTitle, channelThumbnail } = await refreshYouTubeSession()
      setYtConnected(true)
      setYtTokenValid(true)
      setYtChannel({ title: channelTitle, thumbnail: channelThumbnail })
      toast('YouTube session refreshed and ready to upload.', 'success')
    } catch (err) {
      const msg = err?.message || 'Unable to refresh YouTube session. Please try again.'
      setYtError(msg)
      setUploadErr(`YouTube session failed: ${msg}`)
      toast(msg, 'error')
      syncYouTubeStatus()
    } finally {
      setYtConnecting(false)
    }
  }

  function handleDisconnectYouTube() {
    setConfirmDialog({
      title: 'Disconnect YouTube?',
      message: 'Are you sure you want to disconnect your YouTube channel? You can reconnect anytime.',
      confirmLabel: 'Disconnect',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null)
        try {
          await disconnectYouTube()
          setYtConnected(false)
          setYtTokenValid(false)
          setYtChannel({ title: '', thumbnail: '' })
          setYtError('')
          toast('YouTube channel disconnected.', 'info')
        } catch (err) {
          const msg = `Failed to disconnect: ${err.message}`
          setYtError(msg)
          setUploadErr(msg)
          toast(msg, 'error')
        }
      },
    })
  }

  // ── Direct resumable video upload to YouTube (supports exact byte resume) ─
  async function runVideoUpload(modId, lessonId, file, { resumeUploadUrl = null, initialPercent = 0, existingToken = null } = {}) {
    setUploadErr('')
    setYtError('')

    const lesson = courseRef.current?.curriculum
      ?.find(m => m.id === modId)?.lessons
      ?.find(l => l.id === lessonId)

    const controller = new AbortController()
    abortControllers.current[lessonId] = controller

    uploadSessionsRef.current[lessonId] = {
      modId,
      lessonId,
      file,
      uploadUrl: resumeUploadUrl,
      percent: initialPercent,
    }

    setVideoUploads(prev => ({
      ...prev,
      [lessonId]: {
        percent: initialPercent,
        loaded: 0,
        total: file.size,
        status: 'uploading',
        fileName: file.name,
        file,
        uploadUrl: resumeUploadUrl,
        error: '',
        isNetworkError: false,
      },
    }))

    try {
      // 1. Obtain valid access token (use pre-refreshed token if Retry refreshed synchronously)
      const accessToken = existingToken || await getYouTubeAccessToken()
      setYtTokenValid(isYouTubeTokenValid())

      // 2. Stream chunks directly to YouTube, resuming from uploadUrl if provided
      const videoId = await uploadToYouTube(
        file,
        accessToken,
        { title: lesson?.title || file.name, description: `Course video: ${lesson?.title || ''}` },
        {
          onSessionCreated: (url) => {
            if (uploadSessionsRef.current[lessonId]) {
              uploadSessionsRef.current[lessonId].uploadUrl = url
            }
            setVideoUploads(prev => prev[lessonId] ? ({
              ...prev,
              [lessonId]: { ...prev[lessonId], uploadUrl: url },
            }) : prev)
          },
          onProgress: ({ loaded, total, percent, uploadUrl: currentUrl }) => {
            if (uploadSessionsRef.current[lessonId]) {
              uploadSessionsRef.current[lessonId].percent = percent
              if (currentUrl) uploadSessionsRef.current[lessonId].uploadUrl = currentUrl
            }
            setVideoUploads(prev => prev[lessonId] ? ({
              ...prev,
              [lessonId]: {
                ...prev[lessonId],
                percent,
                loaded,
                total,
                uploadUrl: currentUrl || prev[lessonId].uploadUrl,
                status: 'uploading',
              },
            }) : prev)
          },
        },
        controller.signal,
        { resumeUploadUrl }
      )

      // 3. Auto-save the YouTube video ID/URL to the lesson
      updateLesson(modId, lessonId, {
        youtubeId: `https://www.youtube.com/watch?v=${videoId}`,
      })

      delete uploadSessionsRef.current[lessonId]
      setVideoUploads(prev => ({
        ...prev,
        [lessonId]: {
          ...prev[lessonId],
          percent: 100,
          loaded: file.size,
          total: file.size,
          status: 'done',
          videoId,
          file: null,
          uploadUrl: null,
          error: '',
        },
      }))
      toast('Video uploaded to YouTube successfully!', 'success')
    } catch (err) {
      if (err?.cancelled || err?.message === 'Upload cancelled') {
        delete uploadSessionsRef.current[lessonId]
        setVideoUploads(prev => {
          const next = { ...prev }
          delete next[lessonId]
          return next
        })
      } else {
        if (err?.code === 'AUTH_EXPIRED') {
          setYtTokenValid(false)
        }
        const savedUrl = err?.uploadUrl || uploadSessionsRef.current[lessonId]?.uploadUrl || null
        if (uploadSessionsRef.current[lessonId] && savedUrl) {
          uploadSessionsRef.current[lessonId].uploadUrl = savedUrl
        }
        const msg = err?.message || 'Video upload failed. Click Retry to try again.'
        setUploadErr(`Video upload failed: ${msg}`)
        toast(msg, 'error')
        setVideoUploads(prev => {
          const current = prev[lessonId] || {}
          return {
            ...prev,
            [lessonId]: {
              ...current,
              status: 'error',
              file,
              fileName: file.name,
              uploadUrl: savedUrl,
              error: msg,
              isNetworkError: Boolean(err?.isNetworkError),
            },
          }
        })
      }
    } finally {
      delete abortControllers.current[lessonId]
    }
  }

  function handleVideoUpload(modId, lessonId, file) {
    return runVideoUpload(modId, lessonId, file)
  }

  async function retryVideoUpload(modId, lessonId) {
    const upload = videoUploads[lessonId]
    const session = uploadSessionsRef.current[lessonId]
    const file = upload?.file || session?.file
    if (!file) {
      toast('Original video file is no longer in memory. Please select the video again.', 'error')
      return
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const offlineMsg = 'Still offline. Reconnect to the internet and click Retry to continue.'
      setVideoUploads(prev => prev[lessonId] ? ({
        ...prev,
        [lessonId]: { ...prev[lessonId], error: offlineMsg, isNetworkError: true },
      }) : prev)
      toast(offlineMsg, 'error')
      return
    }

    const resumeUploadUrl = upload?.uploadUrl || session?.uploadUrl || null
    const initialPercent = upload?.percent || session?.percent || 0

    // If token expired, refresh synchronously inside this Retry click (prevents popup blocker!)
    let freshToken = null
    if (!isYouTubeTokenValid()) {
      try {
        const refreshed = await refreshYouTubeSession()
        freshToken = refreshed.accessToken
        setYtConnected(true)
        setYtTokenValid(true)
        setYtChannel({ title: refreshed.channelTitle, thumbnail: refreshed.channelThumbnail })
      } catch (err) {
        const msg = err?.message || 'Could not refresh YouTube authorization. Please try again.'
        setYtError(msg)
        setVideoUploads(prev => prev[lessonId] ? ({
          ...prev,
          [lessonId]: { ...prev[lessonId], status: 'error', error: msg },
        }) : prev)
        toast(msg, 'error')
        return
      }
    }

    return runVideoUpload(modId, lessonId, file, {
      resumeUploadUrl,
      initialPercent,
      existingToken: freshToken,
    })
  }

  function dismissVideoUploadError(lessonId) {
    delete uploadSessionsRef.current[lessonId]
    setVideoUploads(prev => {
      const next = { ...prev }
      delete next[lessonId]
      return next
    })
    setUploadErr('')
  }

  function cancelVideoUpload(lessonId) {
    abortControllers.current[lessonId]?.abort()
  }

  if (!course) return <Preloader label="Loading editor" />

  return (
    <div className={`min-h-screen pb-24 ${isDark ? 'bg-neutral-950 text-white' : 'bg-slate-50 text-slate-900'}`}>

      {/* Sticky header bar */}
      <header className={`sticky top-0 z-30 transition-colors ${isDark ? 'bg-neutral-900 border-neutral-800 shadow-none' : 'bg-white border-b border-slate-200 shadow-xs'}`}>
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
          {/* Left: Back & Course Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={handleBackClick}
              className="text-xs sm:text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white transition flex items-center gap-1 shrink-0 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-neutral-800"
              title="Back to all courses"
            >
              ← <span className="hidden sm:inline">All courses</span>
            </button>
            <span className="text-slate-300 dark:text-neutral-700 hidden sm:inline">|</span>
            <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-white truncate max-w-[110px] xs:max-w-[140px] sm:max-w-xs" title={course?.title}>
              {course?.title || 'Untitled course'}
            </span>
          </div>

          {/* Center: Undo / Redo & Add Module Immediately */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-neutral-800 rounded-lg p-0.5 border border-slate-200 dark:border-neutral-700">
              <button
                type="button"
                onClick={undo}
                disabled={past.length === 0}
                title="Undo (Ctrl+Z)"
                className="p-1 sm:p-1.5 text-slate-600 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-neutral-700 rounded-md transition disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <Undo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={future.length === 0}
                title="Redo (Ctrl+Y)"
                className="p-1 sm:p-1.5 text-slate-600 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-neutral-700 rounded-md transition disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <Redo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={addModule}
              title="Create a new module immediately"
              className="flex items-center gap-1 sm:gap-1.5 text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg px-2 sm:px-3 py-1.5 transition shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden xs:inline sm:inline">New module</span>
              <span className="inline xs:hidden sm:hidden">Module</span>
            </button>
          </div>

          {/* Right: Real-time cloud sync status indicator & Save button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {uploading && (
              <span className="text-[11px] sm:text-xs text-amber-600 font-medium animate-pulse flex items-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">{uploading === 'cover' ? 'Cover…' : uploading === 'audio' ? 'Audio…' : 'File…'}</span>
              </span>
            )}
            {Object.values(videoUploads).some(u => u.status === 'uploading') && (
              <span className="text-[11px] sm:text-xs text-blue-600 font-medium animate-pulse flex items-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">YouTube…</span>
              </span>
            )}

            {saving ? (
              <span className="text-[11px] sm:text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1" title="Saving changes across your devices">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden md:inline">Syncing…</span>
              </span>
            ) : hasUnpublished ? (
              <span
                className="text-[11px] sm:text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-md px-2 py-0.5"
                title="Draft saved across all your devices in real time. Click 'Save for students' to publish live."
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <Cloud className="w-3 h-3 text-amber-600 dark:text-amber-400 hidden xs:inline shrink-0" />
                <span>Draft</span>
              </span>
            ) : (
              <span
                className="text-[11px] sm:text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-md px-2 py-0.5"
                title="All changes are published live for students across all devices"
              >
                <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>Live</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => publishForStudents({ showNotification: true })}
              disabled={publishing || saving || !!uploading || !hasUnpublished}
              className={`flex items-center gap-1 sm:gap-1.5 rounded-lg px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold transition shrink-0
                ${hasUnpublished
                  ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm ring-1 ring-amber-500/50'
                  : 'bg-slate-200 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 cursor-default'}`}
              title={hasUnpublished ? 'Publish all draft changes for students' : 'All changes are published for students'}
            >
              {publishing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Publishing…</span>
                </>
              ) : hasUnpublished ? (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Save for students</span>
                  <span className="inline sm:hidden">Save</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden sm:inline">Saved for students</span>
                  <span className="inline sm:hidden">Saved</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Real-time cross-device sync alert banner */}
      {syncNotice && (
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-600 text-white text-xs font-medium py-2 px-4 shadow-md flex items-center justify-center gap-2 animate-fadeIn sticky top-[49px] sm:top-[53px] z-20">
          <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin shrink-0" />
          <span>{syncNotice}</span>
          <button
            type="button"
            onClick={() => setSyncNotice('')}
            className="ml-2 text-white/80 hover:text-white p-0.5 rounded hover:bg-white/10"
            title="Dismiss"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {uploadErr && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-xs text-red-700 dark:text-red-300 shadow-xs"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed break-words">{uploadErr}</span>
            </div>
            <button
              type="button"
              onClick={() => setUploadErr('')}
              aria-label="Dismiss error"
              className="p-1 rounded-md text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── Course details ── */}
        <section className="bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 p-4 sm:p-6 space-y-4 shadow-xs">
          <h2 className="font-semibold text-slate-900 dark:text-white">Course details</h2>

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
                className="text-sm text-slate-500 file:mr-3 file:text-xs file:font-medium file:bg-slate-100 dark:file:bg-neutral-800 dark:file:text-neutral-200 file:border-0 file:rounded file:px-3 file:py-1.5 file:cursor-pointer disabled:opacity-50"
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
        <section className="bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              {/* YouTube icon */}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${ytConnected ? (ytTokenValid ? 'bg-red-500/10' : 'bg-amber-500/10') : 'bg-slate-100 dark:bg-neutral-800'}`}>
                <svg className={`w-5 h-5 ${ytConnected ? (ytTokenValid ? 'text-red-600' : 'text-amber-600') : 'text-slate-400 dark:text-neutral-500'}`} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">
                    {ytLoading ? 'Checking YouTube…' : ytConnected ? 'YouTube Connected' : 'YouTube Upload'}
                  </p>
                  {ytConnected && !ytLoading && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      ytTokenValid
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                    }`}>
                      {ytTokenValid ? 'Ready' : 'Session expired'}
                    </span>
                  )}
                </div>
                {ytConnected ? (
                  <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                    Channel: <span className="font-medium text-slate-700 dark:text-neutral-200">{ytChannel.title}</span>
                    <span className="text-slate-400 dark:text-neutral-500"> · Videos upload as Unlisted · Not made for kids</span>
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                    Connect your YouTube channel to upload videos directly from here
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {ytConnected ? (
                <>
                  <button
                    type="button"
                    onClick={handleRefreshYouTube}
                    disabled={ytConnecting || ytLoading}
                    title={ytTokenValid ? 'Switch YouTube account or refresh authorization' : 'Refresh expired YouTube session'}
                    className={`text-xs font-semibold rounded-lg px-3 py-1.5 transition flex items-center gap-1.5 disabled:opacity-50 ${
                      ytTokenValid
                        ? 'border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-800'
                        : 'bg-amber-500 hover:bg-amber-600 text-black shadow-xs'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${ytConnecting ? 'animate-spin' : ''}`} />
                    {ytConnecting ? 'Refreshing…' : ytTokenValid ? 'Switch Account' : 'Refresh Session'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectYouTube}
                    disabled={ytConnecting}
                    className="text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 dark:border-red-900/60 rounded-lg px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 transition disabled:opacity-50"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  type="button"
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

          {ytError && (
            <div
              role="alert"
              className="flex items-start justify-between gap-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300"
            >
              <div className="flex items-start gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed break-words">{ytError}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={ytConnected ? handleRefreshYouTube : handleConnectYouTube}
                  disabled={ytConnecting}
                  title="Retry YouTube connection"
                  className="inline-flex items-center gap-1 rounded-md bg-red-600 hover:bg-red-700 text-white px-2 py-1 text-[11px] font-semibold transition disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" />
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => setYtError('')}
                  title="Dismiss error"
                  className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── Curriculum ── */}
        <section>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <h2 className="font-semibold text-slate-900 dark:text-white">Curriculum</h2>
              <span className="text-[11px] text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 border border-slate-200 dark:border-neutral-700">
                <GripVertical className="w-3 h-3 text-slate-400" />
                Drag to rearrange
              </span>
            </div>
            <button onClick={addModule} className="text-sm font-medium text-goldDeep hover:underline">
              + Add module
            </button>
          </div>

          <div className="space-y-4">
            {(course.curriculum || []).map((mod, mi) => (
              <div key={mod.id} className="space-y-1">
                {/* Module drop indicator BEFORE */}
                {dragOver?.type === 'module' && dragOver.index === mi && dragOver.position === 'before' && (
                  <div className="flex items-center gap-2 py-1 animate-pulse">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shrink-0" />
                    <div className="h-1 flex-1 bg-gradient-to-r from-amber-500 to-amber-300 rounded-full" />
                    <span className="text-[11px] font-mono font-semibold text-amber-600 dark:text-amber-400 shrink-0">Insert as M{mi + 1}</span>
                  </div>
                )}

                <div
                  draggable={true}
                  onDragStart={(e) => {
                    if (activeGripRef.current !== mod.id) {
                      e.preventDefault()
                      return
                    }
                    handleModuleDragStart(e, mi, mod.id)
                  }}
                  onDragOver={(e) => handleModuleDragOver(e, mi)}
                  onDrop={(e) => handleModuleDrop(e, mi)}
                  onDragEnd={handleDragEnd}
                  className={`bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 overflow-hidden transition-all duration-200 ${
                    dragItem?.type === 'module' && dragItem.id === mod.id
                      ? 'opacity-35 scale-[0.99] border-dashed border-amber-400 shadow-inner'
                      : ''
                  }`}
                >
                  {/* Module header */}
                  <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 bg-slate-50 dark:bg-neutral-850 border-b border-slate-200 dark:border-neutral-800">
                    <div
                      onMouseDown={() => { activeGripRef.current = mod.id }}
                      onMouseUp={() => { activeGripRef.current = null }}
                      onTouchStart={() => { activeGripRef.current = mod.id }}
                      onTouchEnd={() => { activeGripRef.current = null }}
                      className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-neutral-700/70 rounded transition shrink-0 touch-none"
                      title="Drag to rearrange module position"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    <span className="font-mono text-xs text-slate-500 dark:text-neutral-400 font-semibold shrink-0 bg-slate-200/80 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                      M{mi + 1}
                    </span>
                    <input
                      value={mod.title}
                      onChange={e => updateModule(mod.id, { title: e.target.value })}
                      className="flex-1 bg-transparent text-sm font-semibold text-slate-800 dark:text-neutral-100 focus:outline-none"
                      placeholder="Module title…"
                    />
                    <button
                      type="button"
                      onClick={() => confirmRemoveModule(mod)}
                      className="text-xs text-red-500 hover:text-red-700 shrink-0 font-medium"
                    >
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
                  <div
                    className="p-4 space-y-3"
                    onDragOver={(e) => {
                      if (dragItem?.type === 'lesson' && (!mod.lessons || mod.lessons.length === 0)) {
                        e.preventDefault()
                        setDragOver({ type: 'module-dropzone', modIndex: mi })
                      }
                    }}
                    onDrop={(e) => {
                      if (dragItem?.type === 'lesson' && (!mod.lessons || mod.lessons.length === 0)) {
                        handleModuleDropZone(e, mi)
                      }
                    }}
                  >
                    {(!mod.lessons || mod.lessons.length === 0) && (
                      <div
                        className={`p-6 text-center rounded-lg border-2 border-dashed transition ${
                          dragOver?.type === 'module-dropzone' && dragOver.modIndex === mi
                            ? 'border-blue-500 bg-blue-50/70 text-blue-700 font-medium'
                            : 'border-slate-200 text-slate-400'
                        }`}
                      >
                        <p className="text-xs">
                          {dragItem?.type === 'lesson' ? 'Drop lesson here to add to this module' : 'No lessons in this module yet. Add one below or drag a lesson here.'}
                        </p>
                      </div>
                    )}
                  {(mod.lessons || []).map((lesson, li) => {
                    const previewId = youtubePreviewId(lesson.youtubeId)
                    return (
                      <div key={lesson.id} className="space-y-1">
                        {/* Lesson drop indicator BEFORE */}
                        {dragOver?.type === 'lesson' && dragOver.modIndex === mi && dragOver.lessonIndex === li && dragOver.position === 'before' && (
                          <div className="flex items-center gap-2 py-0.5 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-blue-600 shadow-sm shrink-0" />
                            <div className="h-0.5 flex-1 bg-gradient-to-r from-blue-600 to-blue-300 rounded-full" />
                            <span className="text-[10px] font-mono font-semibold text-blue-600 shrink-0">Insert at {mi + 1}.{li + 1}</span>
                          </div>
                        )}

                        <div
                          draggable={true}
                          onDragStart={(e) => {
                            e.stopPropagation()
                            if (activeGripRef.current !== lesson.id) {
                              e.preventDefault()
                              return
                            }
                            handleLessonDragStart(e, mi, li, lesson.id)
                          }}
                          onDragOver={(e) => handleLessonDragOver(e, mi, li)}
                          onDrop={(e) => handleLessonDrop(e, mi, li)}
                          onDragEnd={(e) => {
                            e.stopPropagation()
                            handleDragEnd()
                          }}
                          className={`border border-slate-200 dark:border-neutral-800 rounded-lg p-3 space-y-2.5 bg-slate-50/50 dark:bg-neutral-800/40 transition-all duration-200 ${
                            dragItem?.type === 'lesson' && dragItem.id === lesson.id
                              ? 'opacity-35 scale-[0.99] border-dashed border-blue-400 bg-blue-50/40 shadow-inner'
                              : ''
                          }`}
                        >
                          {/* Lesson header */}
                          <div className="flex items-center gap-2">
                            <div
                              onMouseDown={() => { activeGripRef.current = lesson.id }}
                              onMouseUp={() => { activeGripRef.current = null }}
                              onTouchStart={() => { activeGripRef.current = lesson.id }}
                              onTouchEnd={() => { activeGripRef.current = null }}
                              className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-neutral-700/70 rounded transition shrink-0 touch-none"
                              title="Drag to rearrange lesson position"
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </div>

                            <span className="font-mono text-xs text-slate-500 dark:text-neutral-400 font-semibold shrink-0 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 px-1.5 py-0.5 rounded shadow-2xs">
                              {mi + 1}.{li + 1}
                            </span>
                            <input
                              value={lesson.title}
                              onChange={e => updateLesson(mod.id, lesson.id, { title: e.target.value })}
                              className="flex-1 text-sm font-medium text-slate-800 dark:text-neutral-100 focus:outline-none bg-transparent border-b border-transparent focus:border-slate-300 dark:focus:border-neutral-600 pb-0.5"
                              placeholder="Lesson title…"
                            />
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-medium shrink-0
                              ${lesson.type === 'video' ? 'bg-blue-50 text-blue-600' : lesson.type === 'audio' ? 'bg-purple-50 text-purple-600' : 'bg-amber-50 text-amber-700'}`}>
                              {lesson.type}
                            </span>
                            <button
                              type="button"
                              onClick={() => confirmRemoveLesson(mod.id, lesson)}
                              title={`Delete lesson: ${lesson.title || 'Untitled'}`}
                              className="text-slate-400 hover:text-red-500 transition text-xs shrink-0 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30"
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
                           const hasResumableFile = Boolean(upload?.file || uploadSessionsRef.current[lesson.id]?.file)
                           const formatMB = (bytes) => `${((bytes || 0) / (1024 * 1024)).toFixed(1)} MB`
                           return (
                           <div className="space-y-2.5">

                             {/* Upload progress bar */}
                             {isUploading && (
                               <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-lg p-3 space-y-2">
                                 <div className="flex items-center justify-between gap-2">
                                   <div className="flex items-center gap-2 min-w-0">
                                     <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                     </svg>
                                     <span className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate">
                                       Uploading to YouTube… {upload.percent}%
                                       {upload.total > 0 && (
                                         <span className="text-blue-500 dark:text-blue-400/80 font-normal ml-1.5">
                                           ({formatMB(upload.loaded)} / {formatMB(upload.total)})
                                         </span>
                                       )}
                                     </span>
                                   </div>
                                   <button
                                     type="button"
                                     onClick={() => cancelVideoUpload(lesson.id)}
                                     className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 font-medium shrink-0"
                                   >
                                     Cancel
                                   </button>
                                 </div>
                                 <div className="w-full bg-blue-200 dark:bg-blue-900/50 rounded-full h-2 overflow-hidden">
                                   <div
                                     className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300 ease-out"
                                     style={{ width: `${upload.percent}%` }}
                                   />
                                 </div>
                                 <p className="text-[10px] text-blue-500 dark:text-blue-400 truncate">{upload.fileName}</p>
                               </div>
                             )}

                             {/* Upload success */}
                             {uploadDone && (
                               <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-lg p-2.5">
                                 <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                 </svg>
                                 <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                   Video uploaded successfully!
                                 </span>
                               </div>
                             )}

                             {/* Upload interrupted / error with small Retry icon to resume */}
                             {uploadError && (
                               <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-lg p-3 space-y-2">
                                 <div className="flex items-start justify-between gap-2.5">
                                   <div className="flex items-start gap-2 min-w-0">
                                     <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                     <div className="min-w-0">
                                       <p className="text-xs font-medium text-red-700 dark:text-red-300 leading-relaxed break-words">
                                         {upload.error}
                                       </p>
                                       {upload.fileName && (
                                         <p className="text-[10px] text-red-500/80 dark:text-red-400/80 truncate mt-0.5">
                                           {upload.fileName}
                                           {upload.percent > 0 ? ` · Stopped at ${upload.percent}%` : ''}
                                         </p>
                                       )}
                                     </div>
                                   </div>

                                   <div className="flex items-center gap-1 shrink-0">
                                     {hasResumableFile && (
                                       <button
                                         type="button"
                                         onClick={() => retryVideoUpload(mod.id, lesson.id)}
                                         title={upload.percent > 0 ? `Retry and resume from ${upload.percent}%` : 'Retry upload'}
                                         aria-label="Retry upload"
                                         className="inline-flex items-center gap-1 rounded-md bg-amber-500 hover:bg-amber-600 text-black px-2 py-1 text-[11px] font-semibold shadow-xs transition"
                                       >
                                         <RotateCcw className="w-3.5 h-3.5" />
                                         <span>Retry</span>
                                       </button>
                                     )}
                                     <button
                                       type="button"
                                       onClick={() => dismissVideoUploadError(lesson.id)}
                                       title="Dismiss"
                                       aria-label="Dismiss upload error"
                                       className="p-1 rounded-md text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition"
                                     >
                                       <X className="w-3.5 h-3.5" />
                                     </button>
                                   </div>
                                 </div>

                                 {upload.percent > 0 && (
                                   <div className="w-full bg-red-200/70 dark:bg-red-950 rounded-full h-1.5 overflow-hidden">
                                     <div
                                       className="bg-amber-500 h-1.5 rounded-full transition-all"
                                       style={{ width: `${upload.percent}%` }}
                                     />
                                   </div>
                                 )}
                               </div>
                             )}

                             {/* Direct upload button (shown when YouTube is connected and not uploading) */}
                             {ytConnected && !isUploading && !previewId && (
                               <label className="group flex items-center justify-center gap-2 border-2 border-dashed border-blue-300 dark:border-blue-800/70 hover:border-blue-500 rounded-lg px-4 py-4 cursor-pointer bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100/60 dark:hover:bg-blue-950/35 transition">
                                 <svg className="w-5 h-5 text-blue-500 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                 </svg>
                                 <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:text-blue-700">
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

                             {/* Thumbnail preview with Interactive Preview Button */}
                             {previewId && (
                               <div className="flex items-center gap-3 bg-white dark:bg-neutral-900 rounded-lg p-2.5 border border-slate-200 dark:border-neutral-800 shadow-sm">
                                 {/* Clickable thumbnail with Play overlay */}
                                 <div
                                   onClick={() => setPreviewModalVideo({ youtubeId: previewId, title: lesson.title || 'Video Lesson Preview' })}
                                   className="relative group w-24 h-16 rounded-md overflow-hidden bg-slate-900 cursor-pointer shrink-0"
                                   title="Click to preview video in popup"
                                 >
                                   <img
                                     src={`https://img.youtube.com/vi/${previewId}/mqdefault.jpg`}
                                     alt=""
                                     className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                     onError={e => { e.target.style.display = 'none' }}
                                   />
                                   <div className="absolute inset-0 bg-black/35 group-hover:bg-black/55 transition-colors flex items-center justify-center">
                                     <div className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                                       <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                     </div>
                                   </div>
                                 </div>

                                 <div className="min-w-0 flex-1">
                                   <div className="flex items-center gap-2 flex-wrap">
                                     <p className="text-xs font-semibold text-slate-700 dark:text-neutral-200 flex items-center gap-1.5">
                                       <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                       Video ready
                                     </p>
                                     <span className="font-mono text-[10px] text-slate-400 truncate">{previewId}</span>
                                   </div>

                                   <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                     <button
                                       type="button"
                                       onClick={() => setPreviewModalVideo({ youtubeId: previewId, title: lesson.title || 'Video Lesson Preview' })}
                                       className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 hover:underline"
                                     >
                                       <Play className="w-3 h-3 fill-current" />
                                       Preview video
                                     </button>

                                     {/* Replace button: allow uploading a new video even when one exists */}
                                     {ytConnected && (
                                       <label className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-neutral-300 hover:underline cursor-pointer shrink-0">
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
                                 </div>
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

                        {/* Lesson drop indicator AFTER */}
                        {dragOver?.type === 'lesson' && dragOver.modIndex === mi && dragOver.lessonIndex === li && dragOver.position === 'after' && (
                          <div className="flex items-center gap-2 py-0.5 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-blue-600 shadow-sm shrink-0" />
                            <div className="h-0.5 flex-1 bg-gradient-to-r from-blue-600 to-blue-300 rounded-full" />
                            <span className="text-[10px] font-mono font-semibold text-blue-600 shrink-0">Insert at {mi + 1}.{li + 2}</span>
                          </div>
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

              {/* Module drop indicator AFTER */}
              {dragOver?.type === 'module' && dragOver.index === mi && dragOver.position === 'after' && (
                <div className="flex items-center gap-2 py-1 animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shrink-0" />
                  <div className="h-1 flex-1 bg-gradient-to-r from-amber-500 to-amber-300 rounded-full" />
                  <span className="text-[11px] font-mono font-semibold text-amber-600 dark:text-amber-400 shrink-0">Insert as M{mi + 2}</span>
                </div>
              )}
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

      {/* ── Video Preview Modal ── */}
      {previewModalVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setPreviewModalVideo(null)}
        >
          <div
            className="relative w-full max-w-3xl bg-neutral-900 text-white rounded-2xl overflow-hidden shadow-2xl border border-neutral-800"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-neutral-950/70">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center shrink-0">
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                </div>
                <h3 className="font-semibold text-sm truncate">
                  {previewModalVideo.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalVideo(null)}
                className="text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-neutral-800 transition"
                title="Close preview (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player */}
            <div className="aspect-video w-full bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${previewModalVideo.youtubeId}?autoplay=1&rel=0`}
                title={previewModalVideo.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation Modal ── */}
      {confirmDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setConfirmDialog(null)}
        >
          <div
            className={`relative w-full max-w-md rounded-2xl p-6 shadow-2xl border ${
              isDark ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                confirmDialog.confirmVariant === 'danger'
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-base">{confirmDialog.title}</h3>
                <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">
                  {confirmDialog.message}
                </p>
                {confirmDialog.details && (
                  <p className="text-xs text-slate-400 dark:text-neutral-500 mt-2 font-mono bg-slate-50 dark:bg-neutral-800/50 p-2 rounded-lg">
                    {confirmDialog.details}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              {!confirmDialog.isAlert && (
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800 transition"
                >
                  {confirmDialog.cancelLabel || 'Cancel'}
                </button>
              )}
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-2 text-xs font-semibold rounded-lg text-white transition ${
                  confirmDialog.confirmVariant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {confirmDialog.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Route-Off Exit Prompt Modal (Unpublished changes) ── */}
      {exitPromptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setExitPromptOpen(false)}
        >
          <div
            className={`relative w-full max-w-lg rounded-2xl p-6 shadow-2xl border ${
              isDark ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onClick={e => e.stopPropagation()}
          >
            {/* Top-right cancel button (stay in editor) */}
            <button
              type="button"
              onClick={() => setExitPromptOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition"
              title="Cancel & stay in editor"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4 pr-6">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-lg">Unpublished Draft Changes</h3>
                <p className="text-sm text-slate-600 dark:text-neutral-300 mt-1">
                  You have edits saved in your draft. Students currently see the previously published version of this course.
                </p>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-2">
                  Would you like to publish these changes for students now, keep them saved as a draft, or exit without saving (revert to live)?
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={handleExitWithoutSaving}
                className="order-3 sm:order-1 px-4 py-2 text-xs font-semibold rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/50 transition text-center"
                title="Discard unsaved changes and reset editor to live published version"
              >
                Exit without saving
              </button>
              <button
                type="button"
                onClick={handleExitDraft}
                className="order-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 hover:bg-slate-200 dark:hover:bg-neutral-700 transition text-center"
              >
                Keep as draft & exit
              </button>
              <button
                type="button"
                onClick={handleExitPublish}
                disabled={publishing}
                className="order-1 sm:order-3 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                Save for students & exit
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .editor-input {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          padding: 0.625rem 0.875rem;
          font-size: 0.9375rem;
          background: #f8fafc;
          color: #0f172a;
          outline: none;
          transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
        }
        .editor-input:focus {
          border-color: #c97f1e;
          background: #fff;
          box-shadow: 0 0 0 2px rgba(201, 127, 30, 0.15);
        }
        .dark .editor-input {
          border-color: #334155;
          background: #1e293b;
          color: #f8fafc;
        }
        .dark .editor-input:focus {
          border-color: #f59e0b;
          background: #0f172a;
          box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
        }
        @media (max-width: 640px) {
          .editor-input {
            font-size: 1rem;
          }
        }
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
