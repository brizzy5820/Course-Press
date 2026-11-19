const fs = require('fs')
const path = 'C:\\Users\\User\\Desktop\\work\\COURSE SALES PLATFORM\\src\\pages\\admin\\CourseEditor.jsx'
const content = fs.readFileSync(path, 'utf8')

// Remove duplicate Field function at the end
const fixed = content.replace(/\nfunction Field\(\{ label, children \}\) \{\s*return \(\s*<label className="block">\s*<span className="block text-xs font-medium text-slate-500 mb-1\.5 uppercase tracking-wide">\{label\}<\/span>\s*\{children\}\s*<\/label>\s*\)\s*\}/, '')

fs.writeFileSync(path, fixed, 'utf8')
console.log('Fixed duplicate Field function')