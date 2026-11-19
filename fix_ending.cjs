const fs = require('fs')
const path = 'C:\\Users\\User\\Desktop\\work\\COURSE SALES PLATFORM\\src\\pages\\admin\\CourseEditor.jsx'
const content = fs.readFileSync(path, 'utf8')

// Fix the ending - should be:
//   )
// }
// (not }})
const fixed = content.replace(/\}\)\s*$/, ')\n}')

fs.writeFileSync(path, fixed, 'utf8')
console.log('Fixed ending')