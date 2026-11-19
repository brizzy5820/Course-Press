const fs = require('fs')
const path = 'C:\\Users\\User\\Desktop\\work\\COURSE SALES PLATFORM\\src\\pages\\admin\\AdminDashboard.jsx'
const content = fs.readFileSync(path, 'utf8')

// Remove the extra </div> line (line 454)
const lines = content.split('\n')
// Remove line 454 (0-indexed: 453) which is the extra </div>
lines.splice(453, 1)
const fixed = lines.join('\n')

fs.writeFileSync(path, fixed, 'utf8')
console.log('Removed extra </div> at line 454')