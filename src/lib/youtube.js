// src/lib/youtube.js
//
// 100% Client-Side Direct YouTube Upload via Google Identity Services (GIS).
// Zero Cloud Functions and zero server costs required.
// Video streams directly from browser → YouTube Resumable API.

const STORAGE_KEY_TOKEN   = 'cp_yt_access_token'
const STORAGE_KEY_EXPIRES = 'cp_yt_token_expires'
const STORAGE_KEY_CHANNEL = 'cp_yt_channel'

const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
].join(' ')

let gsiLoadingPromise = null

/** Ensure the Google Identity Services script is loaded */
function loadGsi() {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2)
  if (gsiLoadingPromise) return gsiLoadingPromise

  gsiLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]')
    if (existing) {
      if (window.google?.accounts?.oauth2) {
        resolve(window.google.accounts.oauth2)
        return
      }
      existing.addEventListener('load', () => resolve(window.google.accounts.oauth2))
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services script')))
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.google.accounts.oauth2)
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script'))
    document.head.appendChild(script)
  })

  return gsiLoadingPromise
}

function getClientId() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) {
    throw new Error('Google Client ID is missing. Please set VITE_GOOGLE_CLIENT_ID in your .env file.')
  }
  return clientId
}

/** Fetch channel title & avatar using an active access token */
async function fetchChannelInfo(accessToken) {
  try {
    const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return { title: 'YouTube Channel', thumbnail: '' }
    const data = await res.json()
    const ch = data.items?.[0]
    return {
      title: ch?.snippet?.title || 'YouTube Channel',
      thumbnail: ch?.snippet?.thumbnails?.default?.url || '',
    }
  } catch {
    return { title: 'YouTube Channel', thumbnail: '' }
  }
}

// ---------------------------------------------------------------------------
// Connection & Token Management (Client-Side)
// ---------------------------------------------------------------------------

/** Check YouTube connection status — synchronous check from local storage */
export async function getYouTubeStatus() {
  try {
    const channelRaw = localStorage.getItem(STORAGE_KEY_CHANNEL)
    const token = localStorage.getItem(STORAGE_KEY_TOKEN)
    if (!channelRaw || !token) {
      return { connected: false }
    }
    const channel = JSON.parse(channelRaw)
    return {
      connected: true,
      channelTitle: channel.title || 'YouTube Channel',
      channelThumbnail: channel.thumbnail || '',
    }
  } catch {
    return { connected: false }
  }
}

/** Request an access token from Google popup */
function requestTokenFromGoogle(promptMode = '') {
  return new Promise(async (resolve, reject) => {
    try {
      const oauth2 = await loadGsi()
      const clientId = getClientId()

      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope: YOUTUBE_SCOPES,
        callback: (resp) => {
          if (resp.error) {
            reject(new Error(resp.error_description || resp.error || 'Google authorization failed'))
            return
          }
          if (!resp.access_token) {
            reject(new Error('No access token received from Google'))
            return
          }
          const expiresInMs = (Number(resp.expires_in) || 3500) * 1000
          const expiresAt = Date.now() + expiresInMs

          localStorage.setItem(STORAGE_KEY_TOKEN, resp.access_token)
          localStorage.setItem(STORAGE_KEY_EXPIRES, String(expiresAt))

          resolve(resp.access_token)
        },
        error_callback: (err) => {
          reject(new Error(err?.message || 'Google OAuth failed'))
        },
      })

      client.requestAccessToken({ prompt: promptMode })
    } catch (err) {
      reject(err)
    }
  })
}

/** Start the YouTube connection flow via Google popup */
export async function connectYouTube() {
  const token = await requestTokenFromGoogle('consent')
  const channel = await fetchChannelInfo(token)
  localStorage.setItem(STORAGE_KEY_CHANNEL, JSON.stringify(channel))
  return {
    channelTitle: channel.title,
    channelThumbnail: channel.thumbnail,
  }
}

/** Get a valid access token. Prompts the user only if token is expired */
export async function getYouTubeAccessToken() {
  const token = localStorage.getItem(STORAGE_KEY_TOKEN)
  const expiresAt = Number(localStorage.getItem(STORAGE_KEY_EXPIRES) || 0)

  // Token is still valid (with a 2-minute safety buffer)
  if (token && Date.now() < expiresAt - 120000) {
    return token
  }

  // Token expired or missing — request a fresh one
  return requestTokenFromGoogle('')
}

/** Disconnect YouTube channel from this browser */
export async function disconnectYouTube() {
  const token = localStorage.getItem(STORAGE_KEY_TOKEN)
  if (token && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(token, () => {})
    } catch { /* ignore */ }
  }
  localStorage.removeItem(STORAGE_KEY_TOKEN)
  localStorage.removeItem(STORAGE_KEY_EXPIRES)
  localStorage.removeItem(STORAGE_KEY_CHANNEL)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// YouTube Resumable Upload (Browser → YouTube Direct)
// ---------------------------------------------------------------------------

/**
 * Upload a video file directly to YouTube using the Resumable Upload protocol.
 *
 * @param {File}     file         - The video file (MP4, MOV, etc.)
 * @param {string}   accessToken  - Short-lived YouTube OAuth access token
 * @param {Object}   metadata     - Video metadata (title, description)
 * @param {Function} onProgress   - Called with { loaded, total, percent }
 * @param {AbortSignal} signal    - Optional AbortController signal
 * @returns {Promise<string>}     - Resolves with the YouTube Video ID
 */
export async function uploadToYouTube(file, accessToken, metadata = {}, onProgress, signal) {
  const title       = metadata.title       || file.name.replace(/\.[^.]+$/, '')
  const description = metadata.description || 'Uploaded for course lesson'

  // Step 1: Initiate the resumable upload session
  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        'Authorization':           `Bearer ${accessToken}`,
        'Content-Type':            'application/json; charset=UTF-8',
        'X-Upload-Content-Length': file.size.toString(),
        'X-Upload-Content-Type':   file.type || 'video/mp4',
      },
      body: JSON.stringify({
        snippet: {
          title,
          description,
          categoryId: '27',       // Education
        },
        status: {
          privacyStatus:           'unlisted',
          selfDeclaredMadeForKids: false,
          embeddable:              true,
        },
      }),
      signal,
    }
  )

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}))
    throw new Error(err.error?.message || `YouTube upload init failed (${initRes.status})`)
  }

  const uploadUrl = initRes.headers.get('Location')
  if (!uploadUrl) throw new Error('YouTube did not return a resumable upload URL')

  // Step 2: Stream the file directly to the uploadUrl
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')

    // Track upload progress
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          loaded:  e.loaded,
          total:   e.total,
          percent: Math.round((e.loaded / e.total) * 100),
        })
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          resolve(data.id) // The unique YouTube Video ID
        } catch {
          reject(new Error('Could not parse YouTube upload response'))
        }
      } else {
        let msg = `YouTube upload failed (${xhr.status})`
        try {
          const err = JSON.parse(xhr.responseText)
          msg = err.error?.message || msg
        } catch {}
        reject(new Error(msg))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during YouTube upload'))
    xhr.onabort = () => reject(new Error('Upload cancelled'))

    if (signal) {
      signal.addEventListener('abort', () => xhr.abort())
    }

    xhr.send(file)
  })
}
