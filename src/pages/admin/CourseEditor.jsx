import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCourse, updateCourse } from '../../lib/data'

// ---------------------------------------------------------------------------
// Cloudinary config
// 1. Sign up free at cloudinary.com
// 2. Dashboard -> Settings -> Upload -> Upload presets -> Add upload preset
//    Name it "coursepress_uploads", set Signing mode to "Unsigned" -> Save
// 3. Copy your Cloud Name from the Cloudinary dashboard
// 4. Paste it below
// ---------------------------------------------------------------------------
const CLOUDINARY_CLOUD  = 'dzqpchfew'   // ← replace with your Cloudinary cloud name
const CLOUDINARY_PRESET = 'coursepress_uploads'

async function uploadToCloudinary(file) {
  const form = new FormData()
  form.append('file', file)
  form.append('upload_preset', CLOUDINARY_PRESET)
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`,
    { method: 'POST', body: form }
  )
  if (!res.ok) throw new Error('Cloudinary upload failed')
  const data = await res.json()
  return data.secure_url
}

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

export default function CourseEditor() {
  const { courseId } = useParams()
  const [course,   setCourse]  = useState(null)
  const [saving,   setSaving]  = useState(false)
  const [savedAt,  setSavedAt] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => { getCourse(courseId).then(setCourse) }, [courseId])

  if (!course) return <div className="min-h-screen bg-cream" />

  function set(patch) {
    setCourse(c => ({ ...c, ...patch }))
  }

  async function save() {
    setSaving(true)
    const { id, ...data } = course
    await updateCourse(courseId, data)
    setSaving(false)
    setSavedAt(new Date())
  }

  async function handleCoverUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadToCloudinary(file)
      set({ coverImage: url })
    } catch (err) {
      alert('Cover image upload failed. Check your Cloudinary cloud name and preset.')
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  function addModule() {
    set({
      curriculum: [
        ...(course.curriculum || []),
        { id: uid(), title: 'New module', lessons: [] },
      ],
    })
  }

  function updateModule(modId, patch) {
    set({
      curriculum: course.curriculum.map(m =>
        m.id === modId ? { ...m, ...patch } : m
      ),
    })
  }

  function removeModule(modId) {
    set({ curriculum: course.curriculum.filter(m => m.id !== modId) })
  }

  function addLesson(modId, type) {
    set({
      curriculum: course.curriculum.map(m =>
        m.id === modId
          ? {
              ...m,
              lessons: [
                ...(m.lessons || []),
                {
                  id: uid(),
                  title: 'New lesson',
                  type,
                  youtubeId:   '',
                  content:     '',
                  durationMin: '',
                  resources:   [],
                },
              ],
            }
          : m
      ),
    })
  }

  function updateLesson(modId, lessonId, patch) {
    set({
      curriculum: course.curriculum.map(m =>
        m.id !== modId
          ? m
          : {
              ...m,
              lessons: m.lessons.map(l =>
                l.id === lessonId ? { ...l, ...patch } : l
              ),
            }
      ),
    })
  }

  function removeLesson(modId, lessonId) {
    set({
      curriculum: course.curriculum.map(m =>
        m.id !== modId
          ? m
          : { ...m, lessons: m.lessons.filter(l => l.id !== lessonId) }
      ),
    })
  }

  async function uploadResource(modId, lessonId, file) {
    setUploading(true)
    try {
      const url = await uploadToCloudinary(file)
      const mod    = course.curriculum.find(m => m.id === modId)
      const lesson = mod.lessons.find(l => l.id === lessonId)
      updateLesson(modId, lessonId, {
        resources: [...(lesson.resources || []), { label: file.name, url }],
      })
    } catch (err) {
      alert('File upload failed. Check your Cloudinary cloud name and preset.')
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream pb-24">
      <header className="border-b border-ink/10 sticky top-0 bg-cream/95 backdrop-blur z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-ash hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            All courses
          </Link>
          <div className="flex items-center gap-3">
            {uploading && <span className="text-xs text-goldDeep">Uploading…</span>}
            {savedAt && !uploading && (
              <span className="text-xs text-ash">Saved {savedAt.toLocaleTimeString()}</span>
            )}
            <button
              onClick={save}
              disabled={saving || uploading}
              className="bg-spine text-cream rounded-lg px-4 py-2 text-sm font-medium hover:bg-spineLight disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-10">

        {/* ---- Course details ---- */}
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold mb-2">Details</h2>

          <Field label="Title">
            <input
              value={course.title}
              onChange={e => set({ title: e.target.value })}
              className="w-full border border-ink/15 rounded-lg px-3 py-2 text-sm bg-white"
            />
          </Field>

          <Field label="Subtitle">
            <input
              value={course.subtitle}
              onChange={e => set({ subtitle: e.target.value })}
              className="w-full border border-ink/15 rounded-lg px-3 py-2 text-sm bg-white"
            />
          </Field>

          <Field label="Description">
            <textarea
              rows={5}
              value={course.description}
              onChange={e => set({ description: e.target.value })}
              className="w-full border border-ink/15 rounded-lg px-3 py-2 text-sm bg-white"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (₦)">
              <input
                type="number"
                value={course.price}
                onChange={e => set({ price: Number(e.target.value) })}
                className="w-full border border-ink/15 rounded-lg px-3 py-2 text-sm bg-white"
              />
            </Field>
            <Field label="Cover image (uploads to Cloudinary)">
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                className="text-sm"
              />
            </Field>
          </div>

          {course.coverImage && (
            <img src={course.coverImage} alt="" className="rounded-lg mt-2 max-h-40 object-cover" />
          )}
        </section>

        {/* ---- Curriculum ---- */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-semibold">Curriculum</h2>
            <button
              onClick={addModule}
              className="text-sm font-medium text-goldDeep hover:underline"
            >
              + Add module
            </button>
          </div>

          <div className="space-y-5">
            {(course.curriculum || []).map((mod, mi) => (
              <div key={mod.id} className="border border-ink/10 rounded-xl bg-white">
                {/* Module header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-parchment/50 border-b border-ink/10">
                  <span className="text-xs font-mono text-ash shrink-0">M{mi + 1}</span>
                  <input
                    value={mod.title}
                    onChange={e => updateModule(mod.id, { title: e.target.value })}
                    className="flex-1 bg-transparent font-medium focus:outline-none"
                  />
                  <button
                    onClick={() => removeModule(mod.id)}
                    className="text-xs text-red-600 hover:underline shrink-0"
                  >
                    Remove
                  </button>
                </div>

                {/* Lessons */}
                <div className="p-4 space-y-3">
                  {(mod.lessons || []).map((lesson, li) => (
                    <div key={lesson.id} className="border border-ink/10 rounded-lg p-3">
                      {/* Lesson header row */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-ash w-5 shrink-0">{li + 1}.</span>
                        <input
                          value={lesson.title}
                          onChange={e => updateLesson(mod.id, lesson.id, { title: e.target.value })}
                          className="flex-1 text-sm font-medium focus:outline-none border-b border-transparent focus:border-ink/20"
                        />
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-parchment shrink-0">
                          {lesson.type}
                        </span>
                        <button
                          onClick={() => removeLesson(mod.id, lesson.id)}
                          className="text-xs text-red-600 hover:underline shrink-0"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Video: YouTube ID field */}
                      {lesson.type === 'video' && (
                        <input
                          placeholder="YouTube video ID (e.g. dQw4w9WgXcQ) — upload as Unlisted on YouTube first"
                          value={lesson.youtubeId}
                          onChange={e => updateLesson(mod.id, lesson.id, { youtubeId: e.target.value })}
                          className="w-full border border-ink/15 rounded-lg px-3 py-2 text-sm bg-white"
                        />
                      )}

                      {/* Text: content textarea */}
                      {lesson.type === 'text' && (
                        <textarea
                          rows={4}
                          placeholder="Lesson text content…"
                          value={lesson.content}
                          onChange={e => updateLesson(mod.id, lesson.id, { content: e.target.value })}
                          className="w-full border border-ink/15 rounded-lg px-3 py-2 text-sm bg-white"
                        />
                      )}

                      {/* Duration + resource attachment */}
                      <div className="flex items-center gap-3 mt-2">
                        <input
                          type="number"
                          placeholder="Duration (min)"
                          value={lesson.durationMin}
                          onChange={e => updateLesson(mod.id, lesson.id, { durationMin: e.target.value })}
                          className="border border-ink/15 rounded-lg px-3 py-1.5 text-xs bg-white w-36"
                        />
                        <label className="text-xs text-goldDeep hover:underline cursor-pointer">
                          + Attach download (PDF, etc)
                          <input
                            type="file"
                            className="hidden"
                            onChange={e => {
                              if (e.target.files[0]) uploadResource(mod.id, lesson.id, e.target.files[0])
                            }}
                          />
                        </label>
                      </div>

                      {/* Attached resources list */}
                      {!!lesson.resources?.length && (
                        <ul className="mt-2 space-y-0.5">
                          {lesson.resources.map((r, i) => (
                            <li key={i} className="text-xs text-ash">📎 {r.label}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}

                  <div className="flex gap-4 pt-1">
                    <button
                      onClick={() => addLesson(mod.id, 'video')}
                      className="text-xs font-medium text-goldDeep hover:underline"
                    >
                      + Video lesson
                    </button>
                    <button
                      onClick={() => addLesson(mod.id, 'text')}
                      className="text-xs font-medium text-goldDeep hover:underline"
                    >
                      + Text lesson
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-mono uppercase tracking-wide text-ash mb-1">{label}</span>
      {children}
    </label>
  )
}
