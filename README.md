# CoursePress

A self-hosted course-selling platform: public catalog with full outlines, a
Teachable/Udemy-style course player (sidebar TOC, video speed/quality
controls, mark-as-complete progress), an admin uploader whose module/lesson
order maps 1:1 to what students see, Firebase as the backend, and a
no-password checkout flow (Paystack + manual/bank-transfer access grants).

## 1. Install

```bash
npm install
cp .env.example .env          # fill in after step 2
cd functions && npm install && cd ..
```

## 2. Firebase project setup

1. Create a project at https://console.firebase.google.com
2. Add a **Web App** → copy the config values into `.env` at the project root.
3. Enable **Authentication → Sign-in method → Email link (passwordless)**.
4. Enable **Firestore Database** (production mode, any region close to your users).
5. Enable **Storage**.
6. Deploy rules:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add        # pick your project
   firebase deploy --only firestore:rules,storage:rules
   ```

## 3. Cloud Functions (payments + email)

```bash
cd functions
cp .env.example .env          # fill in Paystack + SMTP credentials
firebase deploy --only functions
```

After deploying, copy the printed function URLs' base
(`https://REGION-PROJECTID.cloudfunctions.net`) into the root `.env` as
`VITE_FUNCTIONS_BASE_URL`.

In your **Paystack dashboard** → Settings → API Keys & Webhooks, set the
webhook URL to `<that base>/paystackWebhook`. This webhook is the source of
truth for automatic purchases; the frontend's call to `/verifyPayment` right
after checkout is just for instant on-screen confirmation.

Any SMTP provider works for `functions/.env` (Gmail app password, Resend,
Postmark, SES, your domain host, etc) — that's what sends the "your access
link" emails for both automatic Paystack purchases and manual grants.

## 4. Make yourself an admin

New accounts default to `role: "student"`. After you sign in once (e.g. via
the login page, requesting a link to your own email), open **Firestore →
users → \<your uid\>** in the Firebase console and change `role` to
`"admin"`. Then visit `/admin`.

## 5. Run it

```bash
npm run dev
```

- `/` — public catalog of published courses
- `/courses/:id` — sales page: full outline + fast checkout (no password)
- `/login` — request a sign-in link (for returning readers)
- `/dashboard` — a signed-in reader's library
- `/dashboard/:id` — the course player (sidebar, video/text lessons, mark complete)
- `/admin` — course list, publish/unpublish, manual access grants
- `/admin/courses/:id` — curriculum builder (modules → lessons → video/text/downloads)

## How the pieces fit together

**Selling a course (automatic):** reader fills in name + email on the course
page → Paystack popup → on success, the Paystack webhook hits your Cloud
Function → it creates (or finds) a Firebase Auth user for that email, writes
their Firestore profile, creates an `enrollments` doc, and emails a
passwordless sign-in link straight into the course.

**Selling a course (manual / bank transfer to you personally):** in
`/admin`, use "Grant manual access" with the reader's name, email, and
course. It runs the exact same account-creation + email flow as an automatic
sale.

**Uploading content:** in the curriculum builder, each module's lessons are
added in the order you want them to appear. A lesson is either a `video`
(paste a YouTube **video ID**, ideally from an Unlisted upload) or `text`
(plain content, rendered with reading-friendly typography on the student
side, with a light/dark toggle). This exact structure is what `CoursePlayer`
reads to build the sidebar and lesson view — there's no separate mapping
step, so what you build in the admin is exactly what students see, in order.


**Progress:** each lesson's "Mark as complete" writes to a `progress`
document; the sidebar shows a green check, and the library page shows
percent-complete per course.


## Notes & things to swap in for production

- YouTube videos should be **Unlisted**, not Private, so the embed loads.
- The Paystack public key (`VITE_PAYSTACK_PUBLIC_KEY`) is safe to expose in
  the frontend; the secret key only ever lives in `functions/.env`.
- Storage rules currently make uploaded files (covers, downloadable
  resources) publicly readable by URL — fine for unlisted-style links, but
  tighten further (e.g. signed URLs) if your resources need to be private.
- `firestore.rules` assumes one role check via `users/{uid}.role`; if you
  need finer-grained admin permissions later, extend that document.
