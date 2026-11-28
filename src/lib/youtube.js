// src/lib/youtube.js
//
// 100% Client-Side Direct YouTube Upload via Google Identity Services (GIS).
// Zero Cloud Functions and zero server costs required.
// Streams video in resumable chunks directly from browser -> YouTube Resumable API,
// supporting exact byte-offset resume after network interruptions.

const STORAGE_KEY_TOKEN   = 'cp_yt_access_token'
const STORAGE_KEY_EXPIRES = 'cp_yt_token_expires'
const STORAGE_KEY_CHANNEL = 'cp_yt_channel'

const UPLOAD_SCOPE   = 'https://www.googleapis.com/auth/youtube.upload'
const READONLY_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly'
const YOUTUBE_SCOPES = `${UPLOAD_SCOPE} ${READONLY_SCOPE}`

// 2-minute safety buffer before expiry
const TOKEN_SAFETY_BUFFER_MS = 120 * 1000

// 8 MiB chunk size (exact multiple of 256 KiB as required by YouTube Resumable API)
const CHUNK_SIZE = 8 * 1024 * 1024

let gsiLoadingPromise = null
let activeAuthPromise = null

// ---------------------------------------------------------------------------
// Error Formatting Helpers
// ---------------------------------------------------------------------------

function makeError(message, extras = {}) {
  const err = new Error(message)
  Object.assign(err, extras)
  return err
}

function formatOAuthError(errOrResp) {
  const code = errOrResp?.error || errOrResp?.type || ''
  const desc = errOrResp?.error_description || errOrResp?.message || ''

  switch (code) {
    case 'popup_failed_to_open':
      return 'Google sign-in popup was blocked by your browser. Please allow popups for this site in your browser bar and try again.'
    case 'popup_closed':
      return 'Google sign-in window was closed before completing authorization. Please try again and finish signing in.'
    case 'access_denied':
      return 'Access was denied. Please grant YouTube upload permission when Google asks so videos can be uploaded.'
    case 'interaction_required':
    case 'login_required':
    case 'consent_required':
      return 'Your Google session needs re-verification. Please click Refresh / Reconnect YouTube and sign in again.'
    case 'admin_policy_enforced':
    case 'org_internal':
      return 'This Google Workspace account restricts third-party YouTube apps. Try a personal Google/YouTube account or ask your Workspace admin.'
    case 'redirect_uri_mismatch':
    case 'origin_mismatch':
      return `Google OAuth origin mismatch for ${window.location.origin}. Add this origin to Authorized JavaScript origins in Google Cloud Console.`
    case 'invalid_client':
      return 'Invalid Google OAuth Client ID (VITE_GOOGLE_CLIENT_ID). Check your environment configuration.'
    default:
      if (desc && desc !== code) return desc
      if (code) return `Google authorization failed (${code}).`
      return 'Google authorization failed. Please disable popup/ad blockers for this site and try again.'
  }
}

function parseYouTubeApiError(status, data, fallback) {
  const apiErr = data?.error || {}
  const reason = apiErr.errors?.[0]?.reason || ''
  const rawMsg = apiErr.message || ''

  if (status === 401 || reason === 'authError' || reason === 'unauthorized') {
    return makeError('Your YouTube session expired or was revoked. Please refresh your connection and retry.', {
      code: 'AUTH_EXPIRED',
      status,
      retryable: true,
    })
  }
  if (reason === 'youtubeSignupRequired') {
    return makeError('This Google account does not have a YouTube channel yet. Create a channel at youtube.com first, then reconnect.', {
      code: 'NO_CHANNEL',
      status,
    })
  }
  if (reason === 'accessNotConfigured') {
    return makeError('YouTube Data API v3 is not enabled in Google Cloud Console for this project.', {
      code: 'API_DISABLED',
      status,
    })
  }
  if (reason === 'quotaExceeded') {
    return makeError('YouTube API daily quota exceeded. Try again after quota resets or switch channels.', {
      code: 'QUOTA_EXCEEDED',
      status,
    })
  }
  if (reason === 'uploadLimitExceeded') {
    return makeError('This YouTube channel has reached its daily video upload limit.', {
      code: 'UPLOAD_LIMIT',
      status,
    })
  }
  if (status === 403 && reason === 'insufficientPermissions') {
    return makeError('Missing YouTube upload permission. Disconnect and reconnect your channel, ensuring all permission checkboxes are checked.', {
      code: 'INSUFFICIENT_PERMISSIONS',
      status,
    })
  }

  return makeError(rawMsg || fallback || `YouTube request failed (${status})`, {
    status,
    retryable: status >= 500,
  })
}

// ---------------------------------------------------------------------------
// Google Identity Services (GIS) Loader
// ---------------------------------------------------------------------------

function getClientId() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId || clientId.includes('your-client-id')) {
    throw new Error('Google Client ID is missing or not configured. Set VITE_GOOGLE_CLIENT_ID in your .env file.')
  }
  return clientId.trim()
}

function injectGsiScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true

    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('Timed out loading Google Sign-In. An ad blocker or firewall may be blocking accounts.google.com.'))
    }, 12000)

    function cleanup() {
      window.clearTimeout(timer)
      script.onload = null
      script.onerror = null
    }

    script.onload = () => {
      cleanup()
      if (window.google?.accounts?.oauth2) {
        resolve(window.google.accounts.oauth2)
      } else {
        reject(new Error('Google Sign-In script loaded, but OAuth2 API is unavailable. Check browser privacy extensions.'))
      }
    }

    script.onerror = () => {
      cleanup()
      script.remove()
      reject(new Error('Could not load Google Sign-In. Please check your internet connection or disable blockers for accounts.google.com.'))
    }

    document.head.appendChild(script)
  })
}

/** Ensure the Google Identity Services script is loaded (retries cleanly after failures) */
export function loadGsi() {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve(window.google.accounts.oauth2)
  }
  if (gsiLoadingPromise) return gsiLoadingPromise

  gsiLoadingPromise = (async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('You are offline. Connect to the internet to use YouTube upload.')
    }

    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]')
    if (existing) {
      // Wait briefly for the existing <script async defer> tag, polling in case load already fired
      const oauth2 = await new Promise((resolve) => {
        let settled = false
        const done = (val) => {
          if (settled) return
          settled = true
          window.clearInterval(pollId)
          window.clearTimeout(fallbackTimer)
          existing.removeEventListener('load', onLoad)
          existing.removeEventListener('error', onErr)
          resolve(val)
        }
        const onLoad = () => done(window.google?.accounts?.oauth2 || null)
        const onErr  = () => done(null)

        existing.addEventListener('load', onLoad)
        existing.addEventListener('error', onErr)

        const pollId = window.setInterval(() => {
          if (window.google?.accounts?.oauth2) done(window.google.accounts.oauth2)
        }, 80)

        // If existing script failed earlier or stalled for 4s, re-inject cleanly
        const fallbackTimer = window.setTimeout(() => done(null), 4000)
      })

      if (oauth2) return oauth2
      // Existing tag failed or stalled — remove and inject a fresh copy
      try { existing.remove() } catch {}
    }

    return injectGsiScript()
  })().catch((err) => {
    // Never cache a failed loading promise so user retries always get a fresh attempt
    gsiLoadingPromise = null
    throw err
  })

  return gsiLoadingPromise
}

/** Non-blocking preload so GIS is ready synchronously when user clicks Connect/Refresh */
export function preloadGsi() {
  loadGsi().catch(() => {})
}

// ---------------------------------------------------------------------------
// Connection & Token Management (Client-Side)
// ---------------------------------------------------------------------------

export function isYouTubeTokenValid() {
  try {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN)
    const expiresAt = Number(localStorage.getItem(STORAGE_KEY_EXPIRES) || 0)
    return Boolean(token && expiresAt && Date.now() < expiresAt - TOKEN_SAFETY_BUFFER_MS)
  } catch {
    return false
  }
}

function clearTokenOnly() {
  try {
    localStorage.removeItem(STORAGE_KEY_TOKEN)
    localStorage.removeItem(STORAGE_KEY_EXPIRES)
  } catch {}
}

/** Check YouTube connection status and whether current access token is still active */
export async function getYouTubeStatus() {
  try {
    const channelRaw = localStorage.getItem(STORAGE_KEY_CHANNEL)
    if (!channelRaw) {
      return { connected: false, tokenValid: false, expiresAt: 0 }
    }
    const channel = JSON.parse(channelRaw)
    const expiresAt = Number(localStorage.getItem(STORAGE_KEY_EXPIRES) || 0)
    const tokenValid = isYouTubeTokenValid()

    return {
      connected: true,
      tokenValid,
      expiresAt,
      channelTitle: channel.title || 'YouTube Channel',
      channelThumbnail: channel.thumbnail || '',
    }
  } catch {
    return { connected: false, tokenValid: false, expiresAt: 0 }
  }
}

function persistToken(resp) {
  const expiresInMs = (Number(resp.expires_in) || 3500) * 1000
  const expiresAt = Date.now() + expiresInMs
  localStorage.setItem(STORAGE_KEY_TOKEN, resp.access_token)
  localStorage.setItem(STORAGE_KEY_EXPIRES, String(expiresAt))
}

function hasRequiredUploadScope(oauth2, resp) {
  if (typeof oauth2?.hasGrantedAllScopes === 'function') {
    if (!oauth2.hasGrantedAllScopes(resp, UPLOAD_SCOPE)) return false
  }
  if (resp.scope && !resp.scope.includes('youtube.upload')) {
    return false
  }
  return true
}

/**
 * Request an access token from Google Identity Services.
 * Runs synchronously when GIS is already loaded so browsers never block the popup.
 */
function requestTokenFromGoogle(promptMode = '', { timeoutMs } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return Promise.reject(new Error('You are offline. Connect to the internet and try again.'))
  }

  if (activeAuthPromise) {
    return activeAuthPromise
  }

  const effectiveTimeout = timeoutMs ?? (promptMode === '' ? 18000 : 180000)

  activeAuthPromise = new Promise((resolve, reject) => {
    let settled = false
    let timer = null

    const finish = (fn, val) => {
      if (settled) return
      settled = true
      if (timer) window.clearTimeout(timer)
      activeAuthPromise = null
      fn(val)
    }

    const startWithOAuth2 = (oauth2) => {
      try {
        const clientId = getClientId()

        timer = window.setTimeout(() => {
          finish(
            reject,
            makeError(
              promptMode === ''
                ? 'YouTube session check timed out. Click Refresh / Reconnect YouTube to continue.'
                : 'Google sign-in timed out. Please try again and allow popups for this site.',
              { code: 'AUTH_TIMEOUT' }
            )
          )
        }, effectiveTimeout)

        const client = oauth2.initTokenClient({
          client_id: clientId,
          scope: YOUTUBE_SCOPES,
          include_granted_scopes: true,
          callback: (resp) => {
            if (resp.error) {
              finish(reject, makeError(formatOAuthError(resp), { code: resp.error }))
              return
            }
            if (!resp.access_token) {
              finish(reject, new Error('No access token was returned by Google. Please try again.'))
              return
            }
            if (!hasRequiredUploadScope(oauth2, resp)) {
              finish(
                reject,
                makeError(
                  'YouTube upload permission was not granted. Please tick the YouTube permission checkbox in the Google sign-in prompt and try again.',
                  { code: 'MISSING_UPLOAD_SCOPE' }
                )
              )
              return
            }

            persistToken(resp)
            finish(resolve, resp.access_token)
          },
          error_callback: (err) => {
            finish(reject, makeError(formatOAuthError(err), { code: err?.type || 'oauth_error' }))
          },
        })

        client.requestAccessToken({ prompt: promptMode })
      } catch (err) {
        finish(reject, err)
      }
    }

    // Fast synchronous path when preloaded (preserves trusted user-gesture activation)
    if (window.google?.accounts?.oauth2) {
      startWithOAuth2(window.google.accounts.oauth2)
    } else {
      loadGsi()
        .then(startWithOAuth2)
        .catch((err) => finish(reject, err))
    }
  })

  return activeAuthPromise
}

/** Fetch channel title & avatar using an active access token and verify a YouTube channel exists */
async function fetchChannelInfo(accessToken) {
  let res
  try {
    res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    throw new Error('Network error while verifying your YouTube channel. Check your connection and try again.')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw parseYouTubeApiError(res.status, data, `Could not verify YouTube channel (${res.status})`)
  }

  const ch = data.items?.[0]
  if (!ch) {
    throw makeError(
      'No YouTube channel exists on this Google account. Go to youtube.com, create your channel first, and then reconnect.',
      { code: 'NO_CHANNEL' }
    )
  }

  return {
    id: ch.id,
    title: ch.snippet?.title || 'YouTube Channel',
    thumbnail: ch.snippet?.thumbnails?.default?.url || '',
  }
}

/** Start the YouTube connection flow via Google popup */
export async function connectYouTube() {
  const token = await requestTokenFromGoogle('consent')
  try {
    const channel = await fetchChannelInfo(token)
    localStorage.setItem(STORAGE_KEY_CHANNEL, JSON.stringify(channel))
    return {
      channelTitle: channel.title,
      channelThumbnail: channel.thumbnail,
    }
  } catch (err) {
    clearTokenOnly()
    localStorage.removeItem(STORAGE_KEY_CHANNEL)
    throw err
  }
}

/** Refresh an expired YouTube session interactively in one click (no popup blocker issues) */
export async function refreshYouTubeSession() {
  const token = await requestTokenFromGoogle('consent')
  const channel = await fetchChannelInfo(token)
  localStorage.setItem(STORAGE_KEY_CHANNEL, JSON.stringify(channel))
  return {
    accessToken: token,
    channelTitle: channel.title,
    channelThumbnail: channel.thumbnail,
  }
}

/** Get a valid access token. Tries cached token first, then silent refresh. */
export async function getYouTubeAccessToken() {
  if (isYouTubeTokenValid()) {
    return localStorage.getItem(STORAGE_KEY_TOKEN)
  }

  // Try silent/auto-select token refresh
  try {
    return await requestTokenFromGoogle('', { timeoutMs: 15000 })
  } catch (err) {
    clearTokenOnly()
    throw err
  }
}

/** Disconnect YouTube channel from this browser */
export async function disconnectYouTube() {
  const token = localStorage.getItem(STORAGE_KEY_TOKEN)
  if (token && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(token, () => {})
    } catch { /* ignore */ }
  }
  clearTokenOnly()
  localStorage.removeItem(STORAGE_KEY_CHANNEL)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// YouTube Chunked Resumable Upload (Browser -> YouTube Direct)
// ---------------------------------------------------------------------------

function parseRangeEnd(rangeHeader) {
  if (!rangeHeader) return null
  const m = String(rangeHeader).match(/bytes=0-(\d+)/i)
  return m ? Number(m[1]) + 1 : null
}

function queryUploadedOffset(uploadUrl, fileSize, accessToken, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
    xhr.setRequestHeader('Content-Range', `bytes */${fileSize}`)

    const onAbort = () => xhr.abort()
    if (signal) {
      if (signal.aborted) {
        reject(makeError('Upload cancelled', { cancelled: true }))
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }

    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onAbort)
    }

    xhr.onload = () => {
      cleanup()
      if (xhr.status === 200 || xhr.status === 201) {
        try {
          const data = JSON.parse(xhr.responseText)
          if (data?.id) {
            resolve({ completed: true, videoId: data.id })
            return
          }
        } catch {}
        resolve({ expired: true })
        return
      }

      if (xhr.status === 308) {
        const range = xhr.getResponseHeader('Range')
        const offset = parseRangeEnd(range)
        resolve({ completed: false, offset: offset ?? 0 })
        return
      }

      if (xhr.status === 401) {
        reject(makeError('Your YouTube session expired. Please refresh your connection and click Retry to resume.', {
          code: 'AUTH_EXPIRED',
          retryable: true,
          uploadUrl,
        }))
        return
      }

      if (xhr.status === 404 || xhr.status === 410) {
        resolve({ expired: true })
        return
      }

      resolve({ expired: true })
    }

    xhr.onerror = () => {
      cleanup()
      const msg = (typeof navigator !== 'undefined' && navigator.onLine === false)
        ? 'You are offline. Reconnect to the internet and click Retry to continue.'
        : 'Network error while checking upload progress. Click Retry to continue.'
      reject(makeError(msg, { retryable: true, isNetworkError: true, uploadUrl }))
    }

    xhr.onabort = () => {
      cleanup()
      reject(makeError('Upload cancelled', { cancelled: true }))
    }

    xhr.send()
  })
}

async function createResumableSession(file, accessToken, metadata, signal) {
  const title       = (metadata.title || file.name.replace(/\.[^.]+$/, '') || 'Course Video').slice(0, 100)
  const description = metadata.description || 'Uploaded for course lesson'

  let initRes
  try {
    initRes = await fetch(
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
            categoryId: '27', // Education
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
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw makeError('Upload cancelled', { cancelled: true })
    }
    const msg = (typeof navigator !== 'undefined' && navigator.onLine === false)
      ? 'No internet connection. Check your network and click Retry.'
      : 'Network error starting YouTube upload. Check your connection and click Retry.'
    throw makeError(msg, { retryable: true, isNetworkError: true })
  }

  if (!initRes.ok) {
    const errData = await initRes.json().catch(() => ({}))
    throw parseYouTubeApiError(initRes.status, errData, `YouTube upload init failed (${initRes.status})`)
  }

  const uploadUrl = initRes.headers.get('Location')
  if (!uploadUrl) {
    throw new Error('YouTube did not return a resumable upload session URL.')
  }
  return uploadUrl
}

function uploadChunk(uploadUrl, file, offset, end, accessToken, onChunkProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')
    xhr.setRequestHeader('Content-Range', `bytes ${offset}-${end - 1}/${file.size}`)

    const onAbort = () => xhr.abort()
    if (signal) {
      if (signal.aborted) {
        reject(makeError('Upload cancelled', { cancelled: true }))
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }

    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onAbort)
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onChunkProgress) {
        onChunkProgress(Math.min(end, offset + e.loaded))
      }
    }

    xhr.onload = () => {
      cleanup()
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          if (!data?.id) {
            reject(new Error('YouTube finished uploading but did not return a video ID.'))
            return
          }
          resolve({ completed: true, videoId: data.id })
        } catch {
          reject(new Error('Could not parse YouTube upload response.'))
        }
        return
      }

      if (xhr.status === 308) {
        const range = xhr.getResponseHeader('Range')
        const serverOffset = parseRangeEnd(range)
        resolve({
          completed: false,
          nextOffset: serverOffset !== null ? serverOffset : end,
        })
        return
      }

      let errData = {}
      try {
        errData = JSON.parse(xhr.responseText)
      } catch {}

      const apiErr = parseYouTubeApiError(xhr.status, errData, `YouTube upload failed (${xhr.status})`)
      apiErr.uploadUrl = uploadUrl
      apiErr.offset = offset
      if (xhr.status >= 500) apiErr.retryable = true
      reject(apiErr)
    }

    xhr.onerror = () => {
      cleanup()
      const msg = (typeof navigator !== 'undefined' && navigator.onLine === false)
        ? 'Network connection lost. Reconnect and click Retry to continue from where it stopped.'
        : 'Connection interrupted during upload. Click Retry to continue from where it stopped.'
      reject(makeError(msg, {
        retryable: true,
        isNetworkError: true,
        uploadUrl,
        offset,
      }))
    }

    xhr.onabort = () => {
      cleanup()
      reject(makeError('Upload cancelled', { cancelled: true }))
    }

    xhr.send(file.slice(offset, end))
  })
}

/**
 * Upload a video file directly to YouTube using chunked Resumable Upload.
 *
 * @param {File}     file         - The video file (MP4, MOV, etc.)
 * @param {string}   accessToken  - Short-lived YouTube OAuth access token
 * @param {Object}   metadata     - Video metadata (title, description)
 * @param {Function|Object} callbacks - Progress callback or { onProgress, onSessionCreated }
 * @param {AbortSignal} signal    - Optional AbortController signal
 * @param {Object}   options      - Optional { resumeUploadUrl }
 * @returns {Promise<string>}     - Resolves with the YouTube Video ID
 */
export async function uploadToYouTube(file, accessToken, metadata = {}, callbacks, signal, options = {}) {
  if (!file || file.size <= 0) {
    throw new Error('Cannot upload an empty video file.')
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw makeError('You are offline. Connect to the internet and click Retry.', {
      retryable: true,
      isNetworkError: true,
      uploadUrl: options.resumeUploadUrl || null,
    })
  }

  const onProgress = typeof callbacks === 'function' ? callbacks : callbacks?.onProgress
  const onSessionCreated = typeof callbacks === 'object' ? callbacks?.onSessionCreated : null

  const emitProgress = (loadedBytes, currentUploadUrl) => {
    if (!onProgress) return
    const clamped = Math.min(file.size, Math.max(0, loadedBytes))
    onProgress({
      loaded: clamped,
      total: file.size,
      percent: Math.min(100, Math.round((clamped / file.size) * 100)),
      uploadUrl: currentUploadUrl,
    })
  }

  let uploadUrl = options.resumeUploadUrl || null
  let offset = 0

  // Step 1: If resuming an interrupted session, ask YouTube for exact received byte offset
  if (uploadUrl) {
    const status = await queryUploadedOffset(uploadUrl, file.size, accessToken, signal)
    if (status.completed) {
      emitProgress(file.size, uploadUrl)
      return status.videoId
    }
    if (status.expired) {
      uploadUrl = null
      offset = 0
    } else {
      offset = status.offset || 0
      emitProgress(offset, uploadUrl)
    }
  }

  // Step 2: Start a fresh resumable upload session if needed
  if (!uploadUrl) {
    uploadUrl = await createResumableSession(file, accessToken, metadata, signal)
    if (onSessionCreated) onSessionCreated(uploadUrl)
    offset = 0
    emitProgress(0, uploadUrl)
  }

  // Step 3: Stream chunks sequentially from `offset` to `file.size`
  while (offset < file.size) {
    if (signal?.aborted) {
      throw makeError('Upload cancelled', { cancelled: true })
    }

    const end = Math.min(offset + CHUNK_SIZE, file.size)
    const result = await uploadChunk(
      uploadUrl,
      file,
      offset,
      end,
      accessToken,
      (loaded) => emitProgress(loaded, uploadUrl),
      signal
    )

    if (result.completed) {
      emitProgress(file.size, uploadUrl)
      return result.videoId
    }

    offset = result.nextOffset
    emitProgress(offset, uploadUrl)
  }

  throw new Error('Upload reached end of file without receiving confirmation from YouTube. Please retry.')
}
