const fs = require('fs')
const path = 'C:\\Users\\User\\Desktop\\work\\COURSE SALES PLATFORM\\src\\pages\\admin\\CourseEditor.jsx'
const content = fs.readFileSync(path, 'utf8')

// Find all div tags
const divOpenRegex = /<div\b[^>]*>/g
const divCloseRegex = /<\/div>/g

let openMatch
const openDivs = []
while ((openMatch = divOpenRegex.exec(content)) !== null) {
  openDivs.push({ index: openMatch.index, text: openMatch[0].substring(0, 50) })
}

let closeMatch
const closeDivs = []
while ((closeMatch = divCloseRegex.exec(content)) !== null) {
  closeDivs.push({ index: closeMatch.index, text: closeMatch[0] })
}

console.log('Open divs:', openDivs.length)
console.log('Close divs:', closeDivs.length)

if (openDivs.length !== closeDivs.length) {
  console.log('MISMATCH:', openDivs.length - closeDivs.length)
  
  // Find which opens don't have closes
  const allDivs = [...openDivs.map(d => ({...d, type: 'open'})), ...closeDivs.map(d => ({...d, type: 'close'}))]
  allDivs.sort((a, b) => a.index - b.index)
  
  let depth = 0
  for (const d of allDivs) {
    if (d.type === 'open') depth++
    else depth--
    if (depth < 0) {
      console.log('Negative depth at', d.index, d.text)
    }
  }
  console.log('Final depth:', depth)
}