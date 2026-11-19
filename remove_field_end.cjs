const fs = require('fs')
const path = 'C:\\Users\\User\\Desktop\\work\\COURSE SALES PLATFORM\\src\\pages\\admin\\CourseEditor.jsx'
const content = fs.readFileSync(path, 'utf8')

// Remove everything after the CourseEditor function ends (the duplicate Field function)
const endMarker = '}\n\nfunction Field({ label, children }) {'
const idx = content.indexOf(endMarker)
if (idx !== -1) {
  const fixed = content.substring(0, idx + 1) + '}'
  fs.writeFileSync(path, fixed, 'utf8')
  console.log('Removed duplicate Field function')
} else {
  console.log('Marker not found')
}