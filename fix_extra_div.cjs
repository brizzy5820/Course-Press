const fs = require('fs')
const path = 'C:\\Users\\User\\Desktop\\work\\COURSE SALES PLATFORM\\src\\pages\\admin\\AdminDashboard.jsx'
const content = fs.readFileSync(path, 'utf8')

// Find and remove the extra </div> at line 454
const fixed = content.replace(/\n      <\/div>\n    <\/>\n  \)\n}\nconst avg/, '\n    </>\n  )\n}\nconst avg')

fs.writeFileSync(path, fixed, 'utf8')
console.log('Fixed extra </div>')