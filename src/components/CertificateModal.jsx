import { useEffect, useState } from 'react'
import { Award, Download, FileText, Loader2, X } from 'lucide-react'
import { renderCertificate, downloadCertificatePNG, downloadCertificatePDF } from '../lib/certificate'

/**
 * Student-facing certificate. Only rendered by callers once progress is 100%.
 * The name comes from the student's profile so it can't be changed at download time.
 */
export default function CertificateModal({ open, onClose, course, name }) {
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  useEffect(() => {
    if (!open) return
    let alive = true
    setPreview(''); setError('')
    renderCertificate(course.certificate, name)
      .then(c => alive && setPreview(c.toDataURL('image/jpeg', 0.85)))
      .catch(e => alive && setError(e.message))
    return () => { alive = false }
  }, [open, course, name])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function run(kind) {
    setBusy(kind); setError('')
    try {
      if (kind === 'png') await downloadCertificatePNG(course.certificate, name, course.title)
      else await downloadCertificatePDF(course.certificate, name, course.title)
    } catch (e) { setError(e.message || 'Download failed. Please try again.') }
    finally { setBusy('') }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm modal-backdrop" onClick={onClose} />
      <div className="relative card w-full max-w-3xl p-5 sm:p-6 modal-in">
        <button onClick={onClose} className="absolute right-4 top-4 icon-btn" aria-label="Close"><X className="h-4 w-4" /></button>
        <h2 className="flex items-center gap-2 text-lg font-semibold pr-10"><Award className="h-5 w-5 text-amber-500" /> Your certificate</h2>
        <p className="text-sm text-muted mt-1">Congratulations on completing <strong>{course.title}</strong>, {name.split(' ')[0]}!</p>

        <div className="mt-5 aspect-[1.414] w-full rounded-lg border border-soft bg-neutral-100 dark:bg-neutral-800 overflow-hidden flex items-center justify-center">
          {preview ? <img src={preview} alt="Certificate preview" className="w-full h-full object-contain" />
            : error ? <p className="text-sm text-red-600 px-6 text-center">{error}</p>
            : <Loader2 className="h-6 w-6 animate-spin text-muted" />}
        </div>
        {error && preview && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button onClick={() => run('png')} disabled={!preview || !!busy} className="btn-secondary justify-center">
            {busy === 'png' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download image
          </button>
          <button onClick={() => run('pdf')} disabled={!preview || !!busy} className="btn-primary justify-center">
            {busy === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Download PDF
          </button>
        </div>
      </div>
    </div>
  )
}

export const hasCertificate = (course) => !!(course?.certificate?.enabled && course?.certificate?.imageUrl)
