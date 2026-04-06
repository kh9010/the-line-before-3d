// Rhythmic clustering: decide where the stanza break falls between 4 fragments.
// Distance = 4-D axis-vector euclidean distance + weighted syllable-count delta.
// The largest gap between consecutive lines gets the stanza break.

import { phrases } from './phrases'

// Simple English syllable approximation: count vowel groups, subtract silent 'e'.
function syllablesInWord(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return 0
  let count = 0
  let prevVowel = false
  for (const c of w) {
    const isVowel = 'aeiouy'.includes(c)
    if (isVowel && !prevVowel) count += 1
    prevVowel = isVowel
  }
  if (w.endsWith('e') && count > 1) count -= 1
  return Math.max(1, count)
}

export function syllableCount(text) {
  return text
    .replace(/\//g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .reduce((sum, w) => sum + syllablesInWord(w), 0)
}

// Euclidean distance in 4-D axis space (values ~ [-1, 1]).
export function axisDistance(axesA, axesB) {
  let s = 0
  for (let i = 0; i < 4; i++) {
    const d = axesA[i] - axesB[i]
    s += d * d
  }
  return Math.sqrt(s)  // 0 to ~4
}

// Combined rhythmic distance between two fragments.
// axis-distance roughly 0..3 typical; syllable-delta scaled to roughly match.
export function rhythmicDistance(fragA, fragB) {
  const ax = axisDistance(fragA.axes, fragB.axes)
  const sylDelta = Math.abs(syllableCount(fragA.text) - syllableCount(fragB.text))
  // Weight: axis distance carries more weight (emotional jump is primary).
  return ax + sylDelta * 0.15
}

// Given an ordered array of 4 chosen fragments (each with text + axes),
// find the index of the largest rhythmic gap. Returns the index of the
// line that starts the second stanza (1, 2, or 3). Default 2 (classic 2+2).
export function findStanzaBreak(chosenFragments) {
  if (chosenFragments.length < 4) return chosenFragments.length
  const gaps = []
  for (let i = 0; i < chosenFragments.length - 1; i++) {
    gaps.push(rhythmicDistance(chosenFragments[i], chosenFragments[i + 1]))
  }
  // Find index of largest gap → that's where the break goes
  let maxIdx = 0
  let maxVal = gaps[0]
  for (let i = 1; i < gaps.length; i++) {
    if (gaps[i] > maxVal) { maxVal = gaps[i]; maxIdx = i }
  }
  // Break is AFTER line maxIdx → second stanza starts at maxIdx + 1
  return maxIdx + 1
}

// Look up a phrase's axes from the phrases pool.
export function getPhraseAxes(text) {
  const p = phrases.find(x => x.text === text)
  return p ? p.axes : [0, 0, 0, 0]
}

// Find a natural caesura in a fragment. Returns a word index where the break
// begins (that word starts the second half of the line), or null if no break.
// Respects hand-authored " / " breaks by skipping them (App handles those).
const BREAK_WORDS = new Set([
  'and', 'but', 'or', 'so', 'yet', 'because', 'when', 'where', 'while',
  'if', 'like', 'on', 'in', 'at', 'of', 'from', 'by', 'with',
  'through', 'for', 'as', 'though', 'until', 'then', 'against',
  'over', 'under', 'into', 'upon',
  'that', 'who', 'whose', 'which', 'whom',
])

// Minimum words on either side of a break — avoids dangling singletons.
const MIN_WORDS_EACH_SIDE = 2

export function findCaesura(text) {
  if (text.includes(' / ')) return null
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length < 5) return null
  const mid = Math.floor(words.length / 2)
  const isValidBreak = (idx) =>
    idx >= MIN_WORDS_EACH_SIDE && (words.length - idx) >= MIN_WORDS_EACH_SIDE
  // Find all break-word candidates, pick the one closest to middle.
  let best = null
  let bestDist = Infinity
  for (let i = 0; i < words.length; i++) {
    if (!isValidBreak(i)) continue
    if (!BREAK_WORDS.has(words[i].toLowerCase())) continue
    const d = Math.abs(i - mid)
    if (d < bestDist) { bestDist = d; best = i }
  }
  return best
}

// Apply caesura to fragment text. Returns { firstLine, secondLine } or null.
export function applyCaesura(text) {
  const words = text.split(/\s+/).filter(Boolean)
  const idx = findCaesura(text)
  if (idx == null) return null
  return {
    firstLine: words.slice(0, idx).join(' '),
    secondLine: words.slice(idx).join(' '),
  }
}

// Expand a fragment into poem-form lines: respect " / " breaks first, then apply
// caesura to each segment. Returns [{ text, indent }].
export function expandToPoemLines(text) {
  const segments = text.split(' / ')
  const out = []
  for (const seg of segments) {
    const idx = findCaesura(seg)
    if (idx == null) {
      out.push({ text: seg, indent: false })
    } else {
      const words = seg.split(/\s+/).filter(Boolean)
      out.push({ text: words.slice(0, idx).join(' '), indent: false })
      out.push({ text: words.slice(idx).join(' '), indent: true })
    }
  }
  return out
}
