// YouTube OAuth Callback Handler
// This page receives the authorization code from Google after the user
// grants YouTube access, and posts it back to the parent window (the popup opener).

import { useEffect } from 'react'

export default function YouTubeCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code  = params.get('code')
    const error = params.get('error')

    if (window.opener) {
      window.opener.postMessage({
        type: 'youtube-auth-code',
        code:  code  || null,
        error: error || null,
      }, window.location.origin)
    }

    // Auto-close the popup after a short delay
    setTimeout(() => window.close(), 1500)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-slate-600 font-medium">Connecting YouTube…</p>
        <p className="text-slate-400 text-sm mt-1">This window will close automatically.</p>
      </div>
    </div>
  )
}

