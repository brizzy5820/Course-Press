# CoursePress update

## 1. Install
    npm i jspdf
(Used only when a student clicks "Download PDF"; it's loaded on demand.)

Make sure tailwind.config.js has `darkMode: 'class'`.

## 2. Firestore rules
Admins now read all users, enrollments and progress. Merge `firestore.rules`
into your Firebase project (Console → Firestore → Rules). Compare it with your
current rules first, especially for orders and payments.

## 3. Admin (/admin)
- Tabs: Overview · Courses · Students · Grant access (the page remembers the open tab).
- Overview: number of students, courses, enrollments and completions, recent
  enrollments, and the completion rate for each course.
- Students: search and filter. Click a student to open their profile:
  - their progress in each course (lessons done, %, last active)
  - assign a new course, reassign (move) a course, unassign, reset progress
  - remove the user from the site. This deletes all their access, progress and
    invites, flags the profile, and signs them out right away. They're blocked
    from coming back. Deleting the login itself still needs the Firebase
    console or Admin SDK.
- You can also see and cancel pending invites.

## 4. Certificates
- Course editor → "Completion certificate": upload the template image
  (stored on Cloudinary), then drag and resize the "Name area" box over where
  the name goes. Pick the font, weight, alignment, colour and capitals, check
  the live preview, and press Save.
- Students see "Get your certificate" on finished course cards and a banner
  in the player after every lesson is done. They can download a PNG or a PDF
  at the template's full resolution, with their profile name added
  automatically (long names shrink to fit). Students can't edit the name.
- How it works: the browser draws the template and the name on a canvas
  (lib/certificate.js). The name box is stored as fractions of the image, so
  it works at any resolution.

## 5. Theme
- New visitors follow their device's light/dark setting and it updates live.
  Picking Light or Dark is remembered. In the admin sidebar there's a
  System / Light / Dark switch. The existing toggle buttons still work.
- Dark mode is fixed across the app. A safety net maps old hard-coded white
  cards, text and borders onto the existing dark palette.
- Optional, to avoid a flash on first load. Add this to index.html <head>:
    <script>(function(){var t=localStorage.getItem('cp-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')})()</script>

## Other fixes
- Saving a course now shows an error if it fails, instead of silently hanging.
- Removed the unused components/clone.tsx.
- Moved the shared animations and buttons into styles/index.css.
