// Crossword layout: place fragments so they intersect at shared letters,
// like a bananagram / scrabble arrangement.

const K = (x, y) => `${x},${y}`

function gridFromPlacements(placements) {
  const grid = new Map()
  for (const p of placements) {
    for (let k = 0; k < p.text.length; k++) {
      const px = p.x + (p.orient === 'h' ? k : 0)
      const py = p.y + (p.orient === 'v' ? k : 0)
      const ch = p.text[k]
      const existing = grid.get(K(px, py))
      if (existing === undefined || existing === ' ') grid.set(K(px, py), ch)
    }
  }
  return grid
}

// Place one new fragment into an existing layout. Returns an updated array
// with the new placement appended. Never modifies the existing placements.
export function placeFragment(prevPlacements, text) {
  if (!prevPlacements || prevPlacements.length === 0) {
    return [{ text, orient: 'h', x: 0, y: 0 }]
  }
  const grid = gridFromPlacements(prevPlacements)
  const canPlace = (t, o, x, y, ix, iy) => {
    for (let k = 0; k < t.length; k++) {
      const px = x + (o === 'h' ? k : 0)
      const py = y + (o === 'v' ? k : 0)
      const ch = t[k]
      if (ch === ' ') continue
      const existing = grid.get(K(px, py))
      if (existing === undefined) continue
      if (existing === ' ') continue
      if (px === ix && py === iy && existing === ch) continue
      return false
    }
    return true
  }
  const candidates = []
  for (const prev of prevPlacements) {
    const newOrient = prev.orient === 'h' ? 'v' : 'h'
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (!/[a-zA-Z]/.test(ch)) continue
      for (let j = 0; j < prev.text.length; j++) {
        if (prev.text[j] !== ch) continue
        const ix = prev.x + (prev.orient === 'h' ? j : 0)
        const iy = prev.y + (prev.orient === 'v' ? j : 0)
        let x, y
        if (newOrient === 'h') { x = ix - i; y = iy } else { x = ix; y = iy - i }
        if (canPlace(text, newOrient, x, y, ix, iy)) {
          let its = 0
          for (let k = 0; k < text.length; k++) {
            const px = x + (newOrient === 'h' ? k : 0)
            const py = y + (newOrient === 'v' ? k : 0)
            const ex = grid.get(K(px, py))
            if (ex !== undefined && ex !== ' ' && ex === text[k]) its++
          }
          candidates.push({ text, orient: newOrient, x, y, its })
        }
      }
    }
  }
  if (candidates.length === 0) {
    const b = getBounds(prevPlacements)
    return [...prevPlacements, { text, orient: 'h', x: b.minX, y: b.maxY + 2 }]
  }
  candidates.sort((a, b) => b.its - a.its || Math.random() - 0.5)
  const pool = candidates.slice(0, Math.min(3, candidates.length))
  const chosen = pool[Math.floor(Math.random() * pool.length)]
  return [...prevPlacements, { text: chosen.text, orient: chosen.orient, x: chosen.x, y: chosen.y }]
}

// Try multiple orderings and pick the most compact. For one-shot builds.
export function buildCrossword(fragments) {
  let best = null
  for (let attempt = 0; attempt < 6; attempt++) {
    let placements = []
    for (const f of fragments) placements = placeFragment(placements, f)
    const b = getBounds(placements)
    const area = b.width * b.height
    if (!best || area < best.area) best = { placed: placements, bounds: b, area }
  }
  return { placed: best.placed, bounds: best.bounds }
}

export function getBounds(placed) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of placed) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    if (p.orient === 'h') {
      maxX = Math.max(maxX, p.x + p.text.length - 1)
      maxY = Math.max(maxY, p.y)
    } else {
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y + p.text.length - 1)
    }
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 0; maxY = 0 }
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 }
}
