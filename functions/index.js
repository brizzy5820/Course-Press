// functions/index.js
//
// Deploy with: firebase deploy --only functions
// Before deploying, set config (Firebase Functions v2 reads plain env vars —
// put these in functions/.env, see .env.example in this folder):
//
//   PAYSTACK_SECRET_KEY=sk_live_xxx
//   FRONTEND_URL=https://your-course-site.com
//   SMTP_HOST=smtp.yourprovider.com
//   SMTP_PORT=587
//   SMTP_USER=you@yourdomain.com
//   SMTP_PASS=xxxx
//   MAIL_FROM="Your Course <you@yourdomain.com>"

const { onRequest } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')
const nodemailer = require('nodemailer')
const cors = require('cors')({ origin: true })

admin.initializeApp()
const db = admin.firestore()

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5174'

// ---------------------------------------------------------------------------
// Google OAuth2 for YouTube uploads
// ---------------------------------------------------------------------------
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI || `${FRONTEND_URL}/admin/youtube-callback`

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})

// ---------------------------------------------------------------------------
// Core: create/find the reader's account, enroll them in the course, and
// email them a passwordless sign-in link straight to their course player.
// Used by both the Paystack webhook AND the admin "manual access" button.
// ---------------------------------------------------------------------------
async function grantAccessAndEmail({ name, email, courseId, source, frontendUrl = FRONTEND_URL }) {
  const courseSnap = await db.collection('courses').doc(courseId).get()
  if (!courseSnap.exists) throw new Error('Course not found')
  const course = courseSnap.data()

  // 1. Find or create the Firebase Auth user for this email.
  let userRecord
  try {
    userRecord = await admin.auth().getUserByEmail(email)
  } catch {
    userRecord = await admin.auth().createUser({ email, displayName: name })
  }

  // 2. Make sure their Firestore profile exists.
  await db.collection('users').doc(userRecord.uid).set({
    name: name || userRecord.displayName || '',
    email,
    role: 'student',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })

  // 3. Enroll them in the course (idempotent — doc id is deterministic).
  await db.collection('enrollments').doc(`${userRecord.uid}_${courseId}`).set({
    uid: userRecord.uid,
    courseId,
    email,
    source,
    grantedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  // 4. Generate a passwordless sign-in link and email it.
  const actionCodeSettings = {
    url: `${frontendUrl}/login?email=${encodeURIComponent(email)}`,
    handleCodeInApp: true,
  }
  const link = await admin.auth().generateSignInWithEmailLink(email, actionCodeSettings)

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: `Your access link: ${course.title}`,
    html: `
      <p>Hi ${name || 'there'},</p>
      <p>You're in! Click below to open <strong>${course.title}</strong> — this link signs you
      straight in, no password needed.</p>
      <p><a href="${link}" style="background:#C97F1E;color:#fff;padding:12px 20px;
        border-radius:8px;text-decoration:none;display:inline-block">Open my course</a></p>
      <p style="color:#888;font-size:12px">If the button doesn't work, copy and paste this link:<br>${link}</p>
    `,
  })

  return userRecord.uid
}

// ---------------------------------------------------------------------------
// Paystack webhook — the authoritative source of truth for automatic
// payments. Configure this URL in your Paystack dashboard under
// Settings -> API Keys & Webhooks.
// ---------------------------------------------------------------------------
exports.paystackWebhook = onRequest(async (req, res) => {
  const crypto = require('crypto')
  const signature = req.headers['x-paystack-signature']
  const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(req.rawBody).digest('hex')
  if (hash !== signature) {
    res.status(401).send('Invalid signature')
    return
  }

  const event = req.body
  if (event.event === 'charge.success') {
    const { reference, metadata, customer, amount } = event.data
    try {
      const orderRef = db.collection('orders').doc(reference)
      const orderSnap = await orderRef.get()
      if (orderSnap.exists && orderSnap.data().status === 'paid') {
        res.status(200).send('Already processed')
        return
      }

      await grantAccessAndEmail({
        name: metadata?.name || customer?.first_name || '',
        email: customer.email,
        courseId: metadata?.courseId || orderSnap.data()?.courseId,
        source: 'paystack',
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5174',
      })

      await orderRef.set({ status: 'paid', amount }, { merge: true })
      res.status(200).send('ok')
    } catch (err) {
      console.error(err)
      res.status(500).send('error')
    }
  } else {
    res.status(200).send('ignored')
  }
})

// ---------------------------------------------------------------------------
// Called by the frontend right after the Paystack popup succeeds, as a fast
// confirmation path. Re-verifies directly with Paystack so a forged client
// call can't grant free access. The webhook above remains the source of
// truth if this call is missed (closed tab, flaky network, etc).
// ---------------------------------------------------------------------------
exports.verifyPayment = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { reference } = req.body
      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      })
      const verifyJson = await verifyRes.json()
      if (!verifyJson.status || verifyJson.data.status !== 'success') {
        res.status(400).json({ error: 'Payment not verified' })
        return
      }

      const orderSnap = await db.collection('orders').doc(reference).get()
      if (orderSnap.exists && orderSnap.data().status === 'paid') {
        res.status(200).json({ ok: true, alreadyProcessed: true })
        return
      }

      const order = orderSnap.data()
      await grantAccessAndEmail({
        name: order?.name,
        email: verifyJson.data.customer.email,
        courseId: order?.courseId || verifyJson.data.metadata?.courseId,
        source: 'paystack',
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5174',
      })
      await db.collection('orders').doc(reference).set({ status: 'paid' }, { merge: true })
      res.status(200).json({ ok: true })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
})

// ---------------------------------------------------------------------------
// Admin-only: grant access for a manual / out-of-band payment (bank
// transfer straight to the creator's personal account, cash, etc).
// ---------------------------------------------------------------------------
exports.adminGrantAccess = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const authHeader = req.headers.authorization || ''
      const token = authHeader.replace('Bearer ', '')
      const decoded = await admin.auth().verifyIdToken(token)
      const callerDoc = await db.collection('users').doc(decoded.uid).get()
      if (callerDoc.data()?.role !== 'admin') {
        res.status(403).json({ error: 'Admins only' })
        return
      }

      const { name, email, courseId } = req.body
      if (!email || !courseId) {
        res.status(400).json({ error: 'email and courseId are required' })
        return
      }
      await grantAccessAndEmail({ name, email, courseId, source: 'manual', frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5174' })
      res.status(200).json({ ok: true })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
})

// ---------------------------------------------------------------------------
// Lets a returning, already-enrolled reader request a fresh sign-in link
// without creating a new purchase.
// ---------------------------------------------------------------------------
exports.resendAccessLink = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { email, origin, frontendUrl } = req.body
      const enrollSnap = await db.collection('enrollments').where('email', '==', email).limit(1).get()
      if (enrollSnap.empty) {
        // Don't reveal whether the email exists — just respond ok either way.
        res.status(200).json({ ok: true })
        return
      }

      const resolvedFrontendUrl = frontendUrl || origin || process.env.FRONTEND_URL || FRONTEND_URL
      const link = await admin.auth().generateSignInWithEmailLink(email, {
        url: `${resolvedFrontendUrl}/login?email=${encodeURIComponent(email)}`,
        handleCodeInApp: true,
      })

      await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to: email,
        subject: 'Your sign-in link',
        html: `<p>Click below to sign in:</p>
               <p><a href="${link}">Sign in to your courses</a></p>`,
      })

      res.status(200).json({ ok: true })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })
})


// ===========================================================================
// YOUTUBE DIRECT UPLOAD — OAuth 2.0 + Token Management
// ===========================================================================
//
// Flow:
//   1. Admin clicks "Connect YouTube" → youtubeGetAuthUrl returns a Google
//      OAuth consent URL scoped to youtube.upload
//   2. Admin grants access → Google redirects to our callback page with a
//      code in the URL
//   3. Callback page sends the code → youtubeExchangeCode swaps it for a
//      refresh_token and stores it securely in Firestore
//   4. When uploading, frontend calls youtubeGetAccessToken → returns a
//      short-lived access_token minted from the stored refresh_token
//   5. Frontend streams the MP4 directly to YouTube's Resumable Upload
//      endpoint using that access_token (never touches our server)
//
// Environment variables required (put in functions/.env):
//   GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
//   GOOGLE_CLIENT_SECRET=GOCSPX-xxx
//   GOOGLE_REDIRECT_URI=https://your-site.com/admin/youtube-callback
// ===========================================================================

// ── Helper: build an OAuth2 client ────────────────────────────────────────
function makeOAuth2Client() {
  const { google } = require('googleapis')
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)
}

// ── Verify caller is an admin ─────────────────────────────────────────────
async function requireAdmin(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) throw new Error('Missing auth token')
  const decoded = await admin.auth().verifyIdToken(token)
  const callerDoc = await db.collection('users').doc(decoded.uid).get()
  if (callerDoc.data()?.role !== 'admin') throw new Error('Admins only')
  return decoded.uid
}

// ---------------------------------------------------------------------------
// 1. youtubeGetAuthUrl — returns the Google consent URL
// ---------------------------------------------------------------------------
exports.youtubeGetAuthUrl = onRequest({ cors: true }, async (req, res) => {
  try {
    await requireAdmin(req)
    const oauth2 = makeOAuth2Client()
    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/youtube.upload'],
    })
    res.status(200).json({ url })
  } catch (err) {
    console.error('youtubeGetAuthUrl error:', err)
    res.status(err.message === 'Admins only' ? 403 : 500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// 2. youtubeExchangeCode — swaps auth code for tokens, stores refresh_token
// ---------------------------------------------------------------------------
exports.youtubeExchangeCode = onRequest({ cors: true }, async (req, res) => {
  try {
    const uid = await requireAdmin(req)
    const { code } = req.body
    if (!code) { res.status(400).json({ error: 'Missing code' }); return }

    const oauth2 = makeOAuth2Client()
    const { tokens } = await oauth2.getToken(code)

    if (!tokens.refresh_token) {
      res.status(400).json({ error: 'No refresh token received. Please revoke access at https://myaccount.google.com/permissions and try again.' })
      return
    }

    // Fetch the channel info so we can show it in the UI
    oauth2.setCredentials(tokens)
    const { google } = require('googleapis')
    const youtube = google.youtube({ version: 'v3', auth: oauth2 })
    let channelTitle = 'YouTube Channel'
    let channelThumbnail = ''
    try {
      const channelRes = await youtube.channels.list({ part: 'snippet', mine: true })
      const ch = channelRes.data.items?.[0]
      if (ch) {
        channelTitle = ch.snippet.title
        channelThumbnail = ch.snippet.thumbnails?.default?.url || ''
      }
    } catch (e) {
      console.warn('Could not fetch channel info:', e.message)
    }

    // Store securely in Firestore (security rules block client reads)
    await db.collection('youtube_connections').doc(uid).set({
      refreshToken: tokens.refresh_token,
      channelTitle,
      channelThumbnail,
      connectedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    res.status(200).json({ ok: true, channelTitle, channelThumbnail })
  } catch (err) {
    console.error('youtubeExchangeCode error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// 3. youtubeGetAccessToken — mints a fresh short-lived access_token
// ---------------------------------------------------------------------------
exports.youtubeGetAccessToken = onRequest({ cors: true }, async (req, res) => {
  try {
    const uid = await requireAdmin(req)
    const snap = await db.collection('youtube_connections').doc(uid).get()
    if (!snap.exists) {
      res.status(404).json({ error: 'YouTube not connected. Please connect your channel first.' })
      return
    }

    const { refreshToken } = snap.data()
    const oauth2 = makeOAuth2Client()
    oauth2.setCredentials({ refresh_token: refreshToken })
    const { token } = await oauth2.getAccessToken()

    if (!token) {
      res.status(500).json({ error: 'Could not refresh access token. Please reconnect your YouTube channel.' })
      return
    }

    res.status(200).json({ accessToken: token })
  } catch (err) {
    console.error('youtubeGetAccessToken error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// 4. youtubeStatus — returns connection status and channel info
// ---------------------------------------------------------------------------
exports.youtubeStatus = onRequest({ cors: true }, async (req, res) => {
  try {
    const uid = await requireAdmin(req)
    const snap = await db.collection('youtube_connections').doc(uid).get()
    if (!snap.exists) {
      res.status(200).json({ connected: false })
      return
    }
    const { channelTitle, channelThumbnail } = snap.data()
    res.status(200).json({ connected: true, channelTitle, channelThumbnail })
  } catch (err) {
    console.error('youtubeStatus error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// 5. youtubeDisconnect — revokes and removes stored credentials
// ---------------------------------------------------------------------------
exports.youtubeDisconnect = onRequest({ cors: true }, async (req, res) => {
  try {
    const uid = await requireAdmin(req)
    const snap = await db.collection('youtube_connections').doc(uid).get()
    if (snap.exists) {
      const { refreshToken } = snap.data()
      // Best-effort revoke with Google
      try {
        const oauth2 = makeOAuth2Client()
        await oauth2.revokeToken(refreshToken)
      } catch (e) { /* token may already be invalid */ }
      await db.collection('youtube_connections').doc(uid).delete()
    }
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('youtubeDisconnect error:', err)
    res.status(500).json({ error: err.message })
  }
})
