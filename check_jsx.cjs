const fs = require('fs')
const path = 'C:\\Users\\User\\Desktop\\work\\COURSE SALES PLATFORM\\src\\pages\\admin\\CourseEditor.jsx'
const content = fs.readFileSync(path, 'utf8')

// Find all JSX tags
const jsxOpenRegex = /<([A-Z][a-zA-Z0-9]*)\b[^>]*>/g
const jsxCloseRegex = /<\/([A-Z][a-zA-Z0-9]*)>/g
const selfCloseRegex = /<([A-Z][a-zA-Z0-9]*)\b[^>]*\/>/g

let openMatch
const openTags = []
while ((openMatch = jsxOpenRegex.exec(content)) !== null) {
  if (!content.substring(openMatch.index).startsWith('/>')) { // Not self-closing
    openTags.push({ tag: openMatch[1], index: openMatch.index })
  }
}

let closeMatch
const closeTags = []
while ((closeMatch = jsxCloseRegex.exec(content)) !== null) {
  closeTags.push({ tag: closeMatch[1], index: closeMatch.index })
}

let selfCloseMatch
const selfCloseTags = []
while ((selfCloseMatch = selfCloseRegex.exec(content)) !== null) {
  selfCloseTags.push({ tag: selfCloseMatch[1], index: selfCloseMatch.index })
}

console.log('Open tags:', openTags.map(t => `${t.tag}@${t.index}`))
console.log('Close tags:', closeTags.map(t => `${t.tag}@${t.index}`))
console.log('Self-close tags:', selfCloseTags.map(t => `${t.tag}@${t.index}`))

// Track unmatched opens
const stack = []
const allOpens = [...openTags, ...selfCloseTags].sort((a, b) => a.index - b.index)
const allCloses = [...closeTags].sort((a, b) => a.index - b.index)

let openIdx = 0, closeIdx = 0
while (openIdx < allOpens.length || closeIdx < allCloses.length) {
  if (closeIdx >= allCloses.length || (openIdx < allOpens.length && allOpens[openIdx].index < allCloses[closeIdx].index)) {
    const tag = allOpens[openIdx]
    if (!tag.tag.includes('/')) { // not self-closing in our detection
      stack.push(tag)
    }
    openIdx++
  } else {
    const closeTag = allCloses[closeIdx]
    if (stack.length > 0 && stack[stack.length - 1].tag === closeTag.tag) {
      stack.pop()
    } else {
      console.log('Mismatched close:', closeTag.tag, '@', closeTag.index)
    }
    closeIdx++
  }
}

console.log('Unclosed tags:', stack.map(t => `${t.tag}@${t.index}`))