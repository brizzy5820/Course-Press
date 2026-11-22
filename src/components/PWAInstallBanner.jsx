import { useState, useEffect } from 'react'
import { Download, X, Share, Sparkles } from 'lucide-react'

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // 1. Check if already installed / running in standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true

    if (isStandalone) {
      setIsInstalled(true)
      return
    }

    // 2. Check if user dismissed banner recently
    const isDismissed = sessionStorage.getItem('cp_pwa_dismissed')
    if (isDismissed) {
      setDismissed(true)
    }

    // 3. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent)
    const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome') && !userAgent.includes('crios')
    if (isIosDevice && isSafari && !isStandalone) {
      setIsIOS(true)
    }

    // 4. Capture beforeinstallprompt for Chrome / Edge / Android
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true)
      return
    }

    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setIsInstalled(true)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem('cp_pwa_dismissed', 'true')
    } catch {}
  }

  // Don't show if installed, dismissed, or unsupported
  if (isInstalled || dismissed || (!deferredPrompt && !isIOS)) {
    return null
  }

  return (
    <>
      {/* Floating Bottom-Right Install Banner */}
      <aside
        aria-label="Install CoursePress App"
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300"
      >
        <div className="flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl bg-neutral-900/95 dark:bg-neutral-900/95 text-white border border-amber-500/30 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
          {/* Brand Icon */}
          <img
            src="/icons/icon-192x192.png"
            alt="CoursePress logo"
            className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-md ring-1 ring-amber-500/40"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-semibold tracking-tight text-white truncate">
                Install CoursePress App
              </h4>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500 text-black shrink-0">
                Fast
              </span>
            </div>
            <p className="text-xs text-neutral-300 mt-0.5 truncate">
              {isIOS
                ? 'Add to home screen for fullscreen experience'
                : 'Install on your device for quick offline access'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-md transition transform active:scale-95"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Install</span>
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
              title="Dismiss"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowIOSInstructions(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl bg-neutral-900 border border-neutral-800 p-6 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <img src="/icons/icon-192x192.png" alt="" className="w-8 h-8 rounded-lg" />
                <h3 className="font-semibold text-sm">Install on iPhone / iPad</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSInstructions(false)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ol className="mt-4 space-y-3 text-xs text-neutral-300">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-black font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <span>
                  Tap the <strong className="text-white">Share button</strong> (
                  <Share className="inline w-3.5 h-3.5 text-amber-400" />
                  ) in Safari's bottom toolbar.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-black font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <span>
                  Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-black font-bold flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <span>
                  Tap <strong className="text-white">"Add"</strong> in the top right to install CoursePress.
                </span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIOSInstructions(false)}
              className="mt-6 w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}

