const fs = require('fs')
const path = 'C:\\Users\\User\\Desktop\\work\\COURSE SALES PLATFORM\\src\\pages\\admin\\CourseEditor.jsx'
const content = fs.readFileSync(path, 'utf8')

const divOpenRegex = /<div\b[^>]*>/g
const divCloseRegex = /<\/div>/g

let openMatch
const openDivs = []
while ((openMatch = divOpenRegex.exec(content)) !== null) {
  openDivs.push({ index: openMatch.index, text: openMatch[0].substring(0, 80) })
}

let closeMatch
const closeDivs = []
while ((closeMatch = divCloseRegex.exec(content)) !== null) {
  closeDivs.push({ index: closeMatch.index, text: closeMatch[0] })
}

const allDivs = [...openDivs.map(d => ({...d, type: 'open'})), ...closeDivs.map(d => ({...d, type: 'close'}))]
allDivs.sort((a, b) => a.index - b.index)

let depth = 0
for (const d of allDivs) {
  if (d.type === 'open') {
    depth++
    if (depth === 1) {
      console.log('ROOT DIV OPEN at', d.index, d.text)
    }
  } else {
    depth--
    if (depth === 0) {
      console.log('ROOT DIV CLOSE at', d.index, d.text)
    }
  }
  if (depth < 0) {
    console.log('NEGATIVE DEPTH at', d.index, d.text)
  }
}
console.log('Final depth:', depth)