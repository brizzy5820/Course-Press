import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCourse, updateCourse } from '../../lib/data'

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

export default function CourseEditor() {
  const { courseId } = useParams()
  const [course,    setCourse]    = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [savedAt,   setSavedAt]   = useState(null)
  const [uploading, setUploading] = useState('')   // '' | 'cover' | 'resource'
  const [uploadErr, setUploadErr] = useState('')

  useEffect(() => { getCourse(courseId).then(setCourse) }, [courseId])

  if (!course) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="h-6 w-6 rounded-full border-2 border-goldDeep border-t-transparent animate-spin" />
    </div>
  )

  function set(patch) { setCourse(c => ({ ...c, ...patch })) }

  async function save() {
    setSaving(true)
    const { id, ...data } = course
    await updateCourse(courseId, data)
    setSaving(false)
    setSavedAt(new Date())
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
            youtubeId: '', content: '', durationMin: '', resources: [],
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

  return (
    <div className="min-h-screen bg-slate-50 pb-24">

      {/* Sticky save bar */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link to="/admin" className="text-sm text-slate-500 hover:text-slate-800 transition">
            ← All courses
          </Link>
          <div className="flex items-center gap-3">
            {uploading && (
              <span className="text-xs text-gold font-medium animate-pulse">
                {uploading === 'cover' ? 'Uploading cover…' : 'Uploading file…'}
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
                className="text-sm text-slate-500 file:mr-3 file:text-xs file:font-medium file:bg-slate-100 file:border-0 file:rounded file:px-3 file:py-1.5 file:cursor-pointer disabled:opacity-50"
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
                            ${lesson.type === 'video' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-700'}`}>
                            {lesson.type}
                          </span>
                          <button
                            onClick={() => removeLesson(mod.id, lesson.id)}
                            className="text-slate-400 hover:text-red-500 transition text-xs shrink-0"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Video: YouTube URL + thumbnail preview */}
                        {lesson.type === 'video' && (
                          <div className="space-y-2">
                            <input
                              placeholder="Paste YouTube URL — e.g. https://www.youtube.com/watch?v=xxxx (set to Unlisted)"
                              value={lesson.youtubeId}
                              onChange={e => updateLesson(mod.id, lesson.id, { youtubeId: e.target.value })}
                              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-goldDeep bg-white"
                            />
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
                              </div>
                            )}
                          </div>
                        )}

                        {/* Text: content textarea */}
                        {lesson.type === 'text' && (
                          <textarea
                            rows={5}
                            placeholder="Lesson text content…"
                            value={lesson.content}
                            onChange={e => updateLesson(mod.id, lesson.id, { content: e.target.value })}
                            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-goldDeep bg-white resize-none"
                          />
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
                    <button onClick={() => addLesson(mod.id, 'text')} className="text-xs font-medium text-amber-600 hover:underline">
                      + Text lesson
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
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