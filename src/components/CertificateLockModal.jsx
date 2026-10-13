import { useEffect } from 'react'
import { Award, X } from 'lucide-react'

/**
 * Shown when a student asks for a certificate before earning it.
 * Explains what's left to do; `action` is an optional CTA (e.g. keep learning).
 */
export default function CertificateLockModal({ open, onClose, message, action = null }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm modal-backdrop" onClick={onClose} />
      <div className="relative card w-full max-w-md p-6 modal-in">
        <button onClick={onClose} className="absolute right-4 top-4 icon-btn" aria-label="Close"><X className="h-4 w-4" /></button>
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
          <Award className="h-5 w-5 text-emerald-500" />
        </div>
        <h2 className="text-lg font-semibold pr-10">Certificate not ready yet</h2>
        <p className="text-sm text-muted mt-1.5 leading-relaxed">{message}</p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button onClick={onClose} className="btn-secondary justify-center">Close</button>
          {action && (
            <button onClick={action.onClick} className="btn-primary justify-center">{action.label}</button>
          )}
        </div>
      </div>
    </div>
  )
}
