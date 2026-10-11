import { useEffect, useRef, useState } from 'react'
import { Award, Upload, Loader2, Move, Eye } from 'lucide-react'
import { CERT_FONTS, DEFAULT_CERT, renderCertificate } from '../lib/certificate'

/**
 * Admin tool: upload a certificate template and drag a box over the spot where
 * the student's name should appear. Saved on the course as `certificate`.
 */
export default function CertificateDesigner({ value, onChange, upload }) {
  const cert = { ...DEFAULT_CERT, ...(value || {}), box: { ...DEFAULT_CERT.box, ...(value?.box || {}) } }
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  const [sample, setSample] = useState('Adaeze Chukwuemeka')
  const [preview, setPreview] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const stageRef = useRef(null)
  const drag = useRef(null)

  const patch = (p) => onChange({ ...cert, ...p })
  const patchBox = (b) => patch({ box: { ...cert.box, ...b } })

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setErr('Please upload an image (PNG or JPG).'); return }
    setErr(''); setUploading(true)
    try {
      const url = await upload(file)
      patch({ imageUrl: url, enabled: true })
    } catch (e2) {
      setErr(`Upload failed: ${e2.message}`)
    } finally { setUploading(false) }
  }

  // Pointer drag: 'move' the box or 'resize' from the corner handle.
  function startDrag(kind, e) {
    e.preventDefault(); e.stopPropagation()
    const rect = stageRef.current.getBoundingClientRect()
    drag.current = { kind, rect, sx: e.clientX, sy: e.clientY, box: { ...cert.box } }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function onMove(e) {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.sx) / d.rect.width
    const dy = (e.clientY - d.sy) / d.rect.height
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
    if (d.kind === 'move') {
      patchBox({ x: clamp(d.box.x + dx, 0, 1 - d.box.w), y: clamp(d.box.y + dy, 0, 1 - d.box.h) })
    } else {
      patchBox({ w: clamp(d.box.w + dx, 0.05, 1 - d.box.x), h: clamp(d.box.h + dy, 0.03, 1 - d.box.y) })
    }
  }
  const endDrag = () => { drag.current = null }

  // Live, pixel-exact preview using the same renderer students use.
  useEffect(() => {
    if (!cert.imageUrl) { setPreview(''); return }
    let alive = true
    setPreviewing(true)
    const t = setTimeout(() => {
      renderCertificate(cert, sample || 'Student Name')
        .then(c => { if (alive) setPreview(c.toDataURL('image/jpeg', 0.8)) })
        .catch(e => { if (alive) setErr(e.message) })
        .finally(() => alive && setPreviewing(false))
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [JSON.stringify(cert), sample]) // eslint-disable-line react-hooks/exhaustive-deps

  const b = cert.box
  return (
    <section className="card p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold"><Award className="h-4 w-4 text-amber-500" /> Completion certificate</h2>
          <p className="text-sm text-muted mt-1">Upload your design, then drag the box over where the student's name goes. Students download it once they finish every lesson.</p>
        </div>
        {cert.imageUrl && (
          <label className="flex items-center gap-2 text-sm shrink-0 cursor-pointer select-none">
            <input type="checkbox" checked={cert.enabled} onChange={e => patch({ enabled: e.target.checked })} className="accent-amber-500 h-4 w-4" />
            Enabled
          </label>
        )}
      </div>

      <label className="btn-secondary w-fit cursor-pointer">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? 'Uploading…' : cert.imageUrl ? 'Replace template' : 'Upload template image'}
        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFile} disabled={uploading} />
      </label>
      {err && <p className="text-sm text-red-600">{err}</p>}

      {cert.imageUrl && (
        <>
          <div
            ref={stageRef}
            className="relative w-full select-none touch-none rounded-lg overflow-hidden border border-soft"
            onPointerMove={onMove} onPointerUp={endDrag} onPointerCancel={endDrag}
          >
            <img src={cert.imageUrl} alt="Certificate template" className="w-full block" draggable={false} crossOrigin="anonymous" />
            <div
              onPointerDown={e => startDrag('move', e)}
              className="absolute border-2 border-dashed border-amber-500 bg-amber-400/15 cursor-move flex items-center justify-center"
              style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-white/80 rounded px-1.5 py-0.5 flex items-center gap-1 pointer-events-none">
                <Move className="h-3 w-3" /> Name area
              </span>
              <span
                onPointerDown={e => startDrag('resize', e)}
                className="absolute -right-1.5 -bottom-1.5 h-3.5 w-3.5 rounded-sm bg-amber-500 border-2 border-white cursor-nwse-resize"
                aria-label="Resize name area"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Font">
              <select className="input" value={cert.font} onChange={e => patch({ font: e.target.value })}>
                {CERT_FONTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </Field>
            <Field label="Weight">
              <select className="input" value={cert.weight} onChange={e => patch({ weight: Number(e.target.value) })}>
                <option value={400}>Regular</option><option value={700}>Bold</option>
              </select>
            </Field>
            <Field label="Alignment">
              <select className="input" value={cert.align} onChange={e => patch({ align: e.target.value })}>
                <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
              </select>
            </Field>
            <Field label="Text colour">
              <div className="flex items-center gap-2">
                <input type="color" value={cert.color} onChange={e => patch({ color: e.target.value })} className="h-9 w-12 rounded border border-soft bg-transparent" />
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input type="checkbox" checked={cert.uppercase} onChange={e => patch({ uppercase: e.target.checked })} className="accent-amber-500" /> CAPS
                </label>
              </div>
            </Field>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted"><Eye className="h-3.5 w-3.5" /> Preview with name</span>
              <input className="input max-w-xs" value={sample} onChange={e => setSample(e.target.value)} />
              {previewing && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
            </div>
            {preview && <img src={preview} alt="Certificate preview" className="w-full rounded-lg border border-soft" />}
          </div>
          <p className="text-xs text-muted">Remember to press <strong>Save</strong> at the top to store certificate changes.</p>
        </>
      )}
    </section>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium uppercase tracking-wide text-muted mb-1">{label}</span>
      {children}
    </label>
  )
}
