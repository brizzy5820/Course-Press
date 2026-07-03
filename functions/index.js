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
