const fs = require('fs')
const path = 'C:\\Users\\User\\Desktop\\work\\COURSE SALES PLATFORM\\src\\pages\\admin\\CourseEditor.jsx'
const content = fs.readFileSync(path, 'utf8')

const divOpenRegex = /<div\b[^>]*>/g
const divCloseRegex = /<\/div>/g

let openMatch
const openDivs = []
while ((openMatch = divOpenRegex.exec(content)) !== null) {
  openDivs.push({ index: openMatch.index, text: openMatch[0].substring(0, 100) })
}

let closeMatch
const closeDivs = []
while ((closeMatch = divCloseRegex.exec(content)) !== null) {
  closeDivs.push({ index: closeMatch.index, text: closeMatch[0] })
}

const allDivs = [...openDivs.map(d => ({...d, type: 'open'})), ...closeDivs.map(d => ({...d, type: 'close'}))]
allDivs.sort((a, b) => a.index - b.index)

let depth = 0
for (let i = 0; i < allDivs.length; i++) {
  const d = allDivs[i]
  if (d.type === 'open') {
    depth++
  } else {
    depth--
  }
  if (depth === 1 && d.type === 'close') {
    console.log('BACK TO ROOT at index', i, 'pos', d.index)
  }
  if (depth === 2 && d.type === 'open') {
    console.log('DEPTH 2 OPEN at', d.index, allDivs[i].text.substring(0, 80))
  }
  if (depth === 2 && d.type === 'close') {
    console.log('DEPTH 2 CLOSE at', d.index, allDivs[i].text.substring(0, 80))
  }
  if (d.type === 'open') depth++
  else depth--
  if (depth < 0) {
    console.log('NEGATIVE at', d.index)
  }
}
console.log('Final depth:', depth)