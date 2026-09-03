// Pair-selection: for each session, pick a fragment-pair per axis.
// A pair = (fragment on negative pole, fragment on positive pole) of that axis,
// drawn from different source files so the superposition morph has two distinct poems.

import { phrases } from './phrases'
import { contexts } from './contexts'
import { shuffle } from './helpers'

// Weight selection toward fragments with strong axis scores (|score| close to 1)
// and with a reasonable context window available.
function weightedPick(candidates) {
  const weights = candidates.map(c => Math.pow(Math.abs(c.score), 2))
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]
    if (r <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

// Pick one fragment for a given (axisIndex, sign). sign = -1 or +1.
// excludePhrases: phrases already used this session.
// excludeSources: source files already used this session.
function pickForPole(axisIndex, sign, excludePhrases, excludeSources) {
  const candidates = phrases
    .filter(p => !excludePhrases.has(p.text))
    .map(p => {
      const ctx = contexts[p.text]
      if (!ctx) return null
      if (excludeSources.has(ctx.sourceFile)) return null
      const score = p.axes[axisIndex] * sign
      if (score <= 0) return null
      return { phrase: p, context: ctx, score }
    })
    .filter(Boolean)

  if (candidates.length === 0) return null
  return weightedPick(candidates)
}

const AXIS_NAMES = [
  ['sublimate', 'crystallise'],
  ['grip', 'release'],
  ['echo', 'ignite'],
  ['smother', 'howl'],
]

// Build 4 pole-pairs for a session, one per axis, in a shuffled axis order.
// Returns: [{ axisIndex, poles: [negWord, posWord], negPick, posPick }] × 4
export function buildSessionPairs() {
  const axisNames = AXIS_NAMES
  const order = shuffle([0, 1, 2, 3])
  const usedPhrases = new Set()
  const usedSources = new Set()
  const rounds = []

  for (const axisIndex of order) {
    const negPick = pickForPole(axisIndex, -1, usedPhrases, usedSources)
    if (negPick) {
      usedPhrases.add(negPick.phrase.text)
      usedSources.add(negPick.context.sourceFile)
    }
    const posPick = pickForPole(axisIndex, +1, usedPhrases, usedSources)
    if (posPick) {
      usedPhrases.add(posPick.phrase.text)
      usedSources.add(posPick.context.sourceFile)
    }
    // Skip rounds where either pick is null (orphan fragments)
    if (!negPick || !posPick) continue
    rounds.push({
      axisIndex,
      poles: axisNames[axisIndex],
      negPick,
      posPick,
    })
  }
  return rounds
}

// Clause-session: 4 presses, one per axis (shuffled) so the pole words are
// fresh on every press, laid out as lines of clause slots. Every slot is its
// own pole-pair; each press extracts one clause-sized fragment into the
// growing line.
const LINE_SHAPE = [2, 2]

function pickForPoleRelaxed(axisIndex, sign, usedPhrases, usedSources) {
  // Prefer an unused source poem; if the pool thins, allow source reuse.
  return (
    pickForPole(axisIndex, sign, usedPhrases, usedSources) ||
    pickForPole(axisIndex, sign, usedPhrases, new Set())
  )
}

// Returns: [{ clauses: [{ axisIndex, poles: [negWord, posWord], negPick, posPick }] }] per line
export function buildSessionLines() {
  const order = shuffle([0, 1, 2, 3])
  const usedPhrases = new Set()
  const usedSources = new Set()
  const lines = []
  let slot = 0

  for (const clauseCount of LINE_SHAPE) {
    const clauses = []
    for (let c = 0; c < clauseCount && slot < order.length; c++, slot++) {
      const axisIndex = order[slot]
      const negPick = pickForPoleRelaxed(axisIndex, -1, usedPhrases, usedSources)
      if (negPick) {
        usedPhrases.add(negPick.phrase.text)
        usedSources.add(negPick.context.sourceFile)
      }
      const posPick = pickForPoleRelaxed(axisIndex, +1, usedPhrases, usedSources)
      if (posPick) {
        usedPhrases.add(posPick.phrase.text)
        usedSources.add(posPick.context.sourceFile)
      }
      if (!negPick || !posPick) continue
      clauses.push({ axisIndex, poles: AXIS_NAMES[axisIndex], negPick, posPick })
    }
    if (clauses.length > 0) {
      lines.push({ clauses })
    }
  }
  return lines
}
