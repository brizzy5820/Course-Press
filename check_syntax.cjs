const fs = require('fs')
const path = 'C:\\Users\\User\\Desktop\\work\\COURSE SALES PLATFORM\\src\\pages\\admin\\CourseEditor.jsx'
const content = fs.readFileSync(path, 'utf8')

// Check brace balance
let braceCount = 0
let parenCount = 0
let bracketCount = 0

for (let i = 0; i < content.length; i++) {
  const char = content[i]
  if (char === '{') braceCount++
  else if (char === '}') braceCount--
  else if (char === '(') parenCount++
  else if (char === ')') parenCount--
  else if (char === '[') bracketCount++
  else if (char === ']') bracketCount--
  
  if (braceCount < 0) {
    console.log('Negative brace count at position', i)
    console.log('Context:', content.substring(Math.max(0, i-50), i+50))
    break
  }
}

console.log('Final counts:', { braceCount, parenCount, bracketCount })

// Check for unclosed JSX tags
const jsxOpenTags = content.match(/<[A-Z][a-zA-Z0-9]*\b[^>]*>/g) || []
const jsxCloseTags = content.match(/<\/[A-Z][a-zA-Z0-9]*>/g) || []
console.log('JSX open tags:', jsxOpenTags.length)
console.log('JSX close tags:', jsxCloseTags.length)