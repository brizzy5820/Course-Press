const fs = require('fs')
const path = 'C:\\Users\\User\\Desktop\\work\\COURSE SALES PLATFORM\\src\\pages\\admin\\CourseEditor.jsx'
const content = fs.readFileSync(path, 'utf8')

// Fix the ending - replace the }} at the end with }
const fixed = content.replace(/\}\}\s*$/, '}')

fs.writeFileSync(path, fixed, 'utf8')
console.log('Fixed ending')