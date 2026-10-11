// Certificate rendering — 100% in the browser with <canvas>.
// The admin uploads one template image per course and marks the rectangle where
// the student name goes (stored as fractions 0..1 so it works at any resolution).
// For each student we draw the template at full resolution, then fit the name
// inside that rectangle (auto-shrinking long names) and export PNG or PDF.

export const CERT_FONTS = [
  { id: 'serif',   label: 'Classic serif',  css: '"Playfair Display", Georgia, "Times New Roman", serif' },
  { id: 'script',  label: 'Script',         css: '"Great Vibes", "Brush Script MT", cursive' },
  { id: 'sans',    label: 'Modern sans',    css: '"Space Grotesk", Inter, Arial, sans-serif' },
]

export const DEFAULT_CERT = {
  imageUrl: '',
  box: { x: 0.2, y: 0.42, w: 0.6, h: 0.12 },
  font: 'serif',
  color: '#1f2937',
  weight: 700,
  align: 'center',
  uppercase: false,
  enabled: false,
}

const fontCss = (id) => (CERT_FONTS.find(f => f.id === id) || CERT_FONTS[0]).css

// Make sure webfonts are loaded before drawing, otherwise canvas falls back silently.
let fontsLink = null
export function ensureCertFonts() {
  if (typeof document === 'undefined') return Promise.resolve()
  if (!fontsLink) {
    fontsLink = document.createElement('link')
    fontsLink.rel = 'stylesheet'
    fontsLink.href = 'https://fonts.googleapis.com/css2?family=Great+Vibes&family=Playfair+Display:wght@400;700&display=swap'
    document.head.appendChild(fontsLink)
  }
  const loads = ['Great Vibes', 'Playfair Display', 'Space Grotesk'].flatMap(f =>
    [400, 700].map(w => document.fonts?.load(`${w} 48px "${f}"`).catch(() => {}))
  )
  return Promise.all(loads).then(() => document.fonts?.ready)
}

const imgCache = new Map()
export function loadImage(url) {
  if (imgCache.has(url)) return imgCache.get(url)
  const p = new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // required so the canvas can be exported
    img.onload = () => resolve(img)
    img.onerror = () => { imgCache.delete(url); reject(new Error('Could not load the certificate template image.')) }
    img.src = url
  })
  imgCache.set(url, p)
  return p
}

/** Draw `name` onto the template; returns a canvas at the template's native size. */
export async function renderCertificate(cert, name) {
  const c = { ...DEFAULT_CERT, ...cert, box: { ...DEFAULT_CERT.box, ...(cert?.box || {}) } }
  if (!c.imageUrl) throw new Error('No certificate template has been set for this course.')
  await ensureCertFonts()
  const img = await loadImage(c.imageUrl)
  const W = img.naturalWidth, H = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, W, H)

  const text = c.uppercase ? name.toUpperCase() : name
  const bx = c.box.x * W, by = c.box.y * H, bw = c.box.w * W, bh = c.box.h * H
  const family = fontCss(c.font)

  // Binary-search the largest font size that fits the box width and height.
  let lo = 6, hi = Math.max(8, bh * 1.2)
  ctx.textBaseline = 'middle'
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2
    ctx.font = `${c.weight} ${mid}px ${family}`
    const m = ctx.measureText(text)
    const textH = (m.actualBoundingBoxAscent || mid * 0.75) + (m.actualBoundingBoxDescent || mid * 0.25)
    if (m.width <= bw && textH <= bh) lo = mid; else hi = mid
  }
  ctx.font = `${c.weight} ${lo}px ${family}`
  ctx.fillStyle = c.color
  ctx.textAlign = c.align
  const tx = c.align === 'left' ? bx : c.align === 'right' ? bx + bw : bx + bw / 2
  ctx.fillText(text, tx, by + bh / 2)
  return canvas
}

const safeFile = (s) => String(s).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'certificate'

export async function downloadCertificatePNG(cert, name, courseTitle) {
  const canvas = await renderCertificate(cert, name)
  const blob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('Export failed')), 'image/png'))
  triggerDownload(URL.createObjectURL(blob), `${safeFile(courseTitle)}-${safeFile(name)}.png`)
}

export async function downloadCertificatePDF(cert, name, courseTitle) {
  const canvas = await renderCertificate(cert, name)
  const { jsPDF } = await import('jspdf') // loaded only when needed
  const landscape = canvas.width >= canvas.height
  const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'px', format: [canvas.width, canvas.height], hotfixes: ['px_scaling'] })
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, canvas.width, canvas.height)
  pdf.save(`${safeFile(courseTitle)}-${safeFile(name)}.pdf`)
}

function triggerDownload(href, filename) {
  const a = document.createElement('a')
  a.href = href; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 4000)
}
