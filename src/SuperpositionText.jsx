import { useState, useEffect, useRef, useMemo } from 'react'

// Timing (ms)
const HOLD_MS = 2200
const MORPH_MS = 1000
const SETTLE_MS = 500  // when user picks, rapid settle to chosen side

const SCRAMBLE_CHARS = 'abcdefghijklmnopqrstuvwxyz .,'

function buildAlignment(ctxA, ctxB) {
  const linesA = ctxA.contextLines
  const linesB = ctxB.contextLines
  const n = Math.max(linesA.length, linesB.length)
  const rows = []
  for (let i = 0; i < n; i++) {
    const a = linesA[i] ?? ''
    const b = linesB[i] ?? ''
    const len = Math.max(a.length, b.length)
    rows.push({ a: a.padEnd(len, ' '), b: b.padEnd(len, ' '), len })
  }
  return rows
}

function charAt(row, idx, dir, progress, waveWidth, totalChars, posOffset, scrambleRoll) {
  const charIndex = posOffset + idx
  const wavePos = progress * (totalChars + waveWidth) - waveWidth / 2
  const aCh = row.a[idx]
  const bCh = row.b[idx]
  if (aCh === bCh) return aCh

  const ahead = dir === 'AtoB' ? aCh : bCh
  const behind = dir === 'AtoB' ? bCh : aCh

  const delta = charIndex - wavePos
  if (delta < -waveWidth / 2) return behind
  if (delta > waveWidth / 2) return ahead
  // inside wave: scramble mix
  const r = (scrambleRoll + charIndex) % 7
  if (r < 3) return ahead
  if (r < 5) return behind
  return SCRAMBLE_CHARS[(scrambleRoll + charIndex * 31) % SCRAMBLE_CHARS.length]
}

export default function SuperpositionText({ contextA, contextB, chosenSide, onSettled, extracting }) {
  const chosenCtx = chosenSide === 'A' ? contextA : (chosenSide === 'B' ? contextB : null)
  const fragStart = chosenCtx?.fragmentLineIndex ?? -1
  const fragEnd = chosenCtx ? fragStart + chosenCtx.fragmentLineCount - 1 : -1
  const alignment = useMemo(() => buildAlignment(contextA, contextB), [contextA, contextB])
  const totalChars = useMemo(
    () => alignment.reduce((s, r) => s + r.len, 0),
    [alignment]
  )

  // Precompute per-char opacity based on distance to nearest fragment char (from either poem).
  // Clear radius ~50 chars, fully faded by ~160.
  const opacityMap = useMemo(() => {
    const fragSet = new Set()
    const mark = (ctx, rowStart) => {
      if (!ctx?.fragmentCharRanges) return
      let pos = 0
      for (let i = 0; i < alignment.length; i++) {
        const row = alignment[i]
        if (i >= rowStart && i < rowStart + ctx.fragmentLineCount) {
          const r = ctx.fragmentCharRanges[i - rowStart]
          if (r) for (let c = r[0]; c < r[1]; c++) fragSet.add(pos + c)
        }
        pos += row.len
      }
    }
    mark(contextA, contextA.fragmentLineIndex)
    mark(contextB, contextB.fragmentLineIndex)
    // Build distance map via simple expand from fragment chars
    const N = totalChars
    const dist = new Array(N).fill(Infinity)
    for (const idx of fragSet) dist[idx] = 0
    // Forward pass
    for (let i = 1; i < N; i++) {
      if (dist[i - 1] + 1 < dist[i]) dist[i] = dist[i - 1] + 1
    }
    // Backward pass
    for (let i = N - 2; i >= 0; i--) {
      if (dist[i + 1] + 1 < dist[i]) dist[i] = dist[i + 1] + 1
    }
    // Scale fog radii to text size — small poems fog proportionally rather than staying clear.
    const sizeFactor = Math.min(1, totalChars / 400)
    const CLEAR = 45 * sizeFactor
    const FADE_TO_ZERO = 170 * sizeFactor
    return dist.map(d => {
      if (d <= CLEAR) return 1
      if (d >= FADE_TO_ZERO) return 0
      // Smoothstep from CLEAR → FADE_TO_ZERO
      const t = (d - CLEAR) / (FADE_TO_ZERO - CLEAR)
      return Math.max(0, 1 - t * t * (3 - 2 * t))
    })
  }, [alignment, contextA, contextB, totalChars])

  const [tick, setTick] = useState(0)

  // Refs hold mutable state the rAF loop reads
  const phaseRef = useRef('holdA')
  const progressRef = useRef(0)
  const scrambleRef = useRef(0)
  const phaseStartRef = useRef(performance.now())
  const chosenRef = useRef(null)
  const settledRef = useRef(false)
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled

  // Keep chosenRef current
  useEffect(() => { chosenRef.current = chosenSide }, [chosenSide])

  // Single rAF loop
  useEffect(() => {
    let raf = 0
    let cancelled = false
    const loop = () => {
      if (cancelled) return
      const now = performance.now()
      const elapsed = now - phaseStartRef.current
      let phase = phaseRef.current

      // Handle user choice → settle
      if (chosenRef.current && !settledRef.current &&
          phase !== 'settleToA' && phase !== 'settleToB' &&
          phase !== 'settledA' && phase !== 'settledB') {
        settledRef.current = true
        const showing = (phase === 'holdB' || phase === 'morphToB') ? 'B' : 'A'
        if (showing === chosenRef.current) {
          phase = chosenRef.current === 'A' ? 'settledA' : 'settledB'
          phaseRef.current = phase
          progressRef.current = 0
          setTick(t => t + 1)
          if (onSettledRef.current) onSettledRef.current()
          return  // stop loop
        } else {
          phase = chosenRef.current === 'B' ? 'settleToB' : 'settleToA'
          phaseRef.current = phase
          phaseStartRef.current = now
          progressRef.current = 0
        }
      }

      // Phase transitions
      if (phase === 'settleToA' || phase === 'settleToB') {
        const t = Math.min(1, elapsed / SETTLE_MS)
        progressRef.current = t
        scrambleRef.current = Math.floor(now / 40)
        if (t >= 1) {
          phaseRef.current = phase === 'settleToA' ? 'settledA' : 'settledB'
          progressRef.current = 0
          setTick(tick => tick + 1)
          if (onSettledRef.current) onSettledRef.current()
          return
        }
      } else if (phase === 'holdA' || phase === 'holdB') {
        if (elapsed >= HOLD_MS) {
          phaseRef.current = phase === 'holdA' ? 'morphToB' : 'morphToA'
          phaseStartRef.current = now
          progressRef.current = 0
        }
      } else if (phase === 'morphToB' || phase === 'morphToA') {
        const t = Math.min(1, elapsed / MORPH_MS)
        progressRef.current = t
        scrambleRef.current = Math.floor(now / 40)
        if (t >= 1) {
          phaseRef.current = phase === 'morphToB' ? 'holdB' : 'holdA'
          phaseStartRef.current = now
          progressRef.current = 0
        }
      }

      setTick(t => t + 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelled = true
      if (raf) cancelAnimationFrame(raf)
    }
  }, [alignment])  // restart only when input changes

  // Render
  const phase = phaseRef.current
  const progress = progressRef.current
  const scrambleRoll = scrambleRef.current
  const waveWidth = Math.max(12, totalChars * 0.08)

  // Bucket opacity into 8 levels, group consecutive same-bucket chars into spans.
  const bucket = (o) => Math.round(o * 7) / 7
  let posOffset = 0
  const rendered = alignment.map((row) => {
    const segments = []
    let curOpacity = null
    let curText = ''
    let joined = ''
    for (let i = 0; i < row.len; i++) {
      let ch
      if (phase === 'holdA' || phase === 'settledA') ch = row.a[i]
      else if (phase === 'holdB' || phase === 'settledB') ch = row.b[i]
      else if (phase === 'morphToB' || phase === 'settleToB') {
        ch = charAt(row, i, 'AtoB', progress, waveWidth, totalChars, posOffset, scrambleRoll)
      } else {
        ch = charAt(row, i, 'BtoA', progress, waveWidth, totalChars, posOffset, scrambleRoll)
      }
      joined += ch
      const charOpacity = bucket(opacityMap[posOffset + i] ?? 1)
      if (curOpacity === null) curOpacity = charOpacity
      if (charOpacity !== curOpacity) {
        segments.push({ text: curText, opacity: curOpacity })
        curText = ''
        curOpacity = charOpacity
      }
      curText += ch
    }
    if (curText) segments.push({ text: curText, opacity: curOpacity ?? 1 })
    posOffset += row.len
    return { segments, joined }
  })

  // Suppress unused-var lint on tick by reading it
  void tick

  return (
    <div className={`superposition-text ${extracting ? 'is-extracting' : ''}`}>
      {rendered.map((row, i) => {
        const line = row.joined
        const isFragmentLine = extracting && i >= fragStart && i <= fragEnd
        if (!extracting) {
          // Reading / morph: render with fog-fade via opacity segments
          return (
            <div key={i} className="superposition-line">
              {row.segments.length === 0 ? '\u00A0' : row.segments.map((seg, si) => (
                <span key={si} style={{ opacity: seg.opacity }}>{seg.text}</span>
              ))}
            </div>
          )
        }
        if (!isFragmentLine) {
          return <div key={i} className="superposition-line is-dissolving">{line || '\u00A0'}</div>
        }
        const rangeIdx = i - fragStart
        const range = chosenCtx?.fragmentCharRanges?.[rangeIdx]
        if (!range) {
          return <div key={i} className="superposition-line is-fragment">{line || '\u00A0'}</div>
        }
        const [s, e] = range
        const pre = line.slice(0, s)
        const mid = line.slice(s, e)
        const post = line.slice(e)
        return (
          <div key={i} className="superposition-line is-fragment-line">
            <span className="is-dissolving">{pre}</span>
            <span className="is-fragment">{mid}</span>
            <span className="is-dissolving">{post}</span>
          </div>
        )
      })}
    </div>
  )
}
