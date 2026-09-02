import { useState, useEffect, useRef, useMemo } from 'react'

// Steering model: the two poems share the space, split by a scramble
// wavefront. Holding a pole button pushes the front through the text toward
// that poem — like leaning on a rudder — and holding it all the way to the
// edge commits the choice. Releasing lets the front relax back to a slow
// breathing drift around the midpoint.
const STEER_RATE = 0.55        // lean units/sec while holding
const RELAX_RATE = 1.1         // ease/sec back toward the breathing drift
const BREATHE_AMPL = 0.22
const BREATHE_PERIOD_MS = 7000
const COMMIT_AT = 0.93         // |lean| needed to commit
const COMMIT_DWELL_MS = 200    // held at the pole this long → committed

const SCRAMBLE_CHARS = 'abcdefghijklmnopqrstuvwxyz .,'

// iA Writer export artifacts — never show them. A space keeps every
// fragmentCharRange index valid.
const cleanLine = (s) => s.replace(/[/\\]/g, ' ')

function buildAlignment(ctxA, ctxB) {
  const linesA = ctxA.contextLines
  const linesB = ctxB.contextLines
  const n = Math.max(linesA.length, linesB.length)
  const rows = []
  for (let i = 0; i < n; i++) {
    const a = cleanLine(linesA[i] ?? '')
    const b = cleanLine(linesB[i] ?? '')
    const len = Math.max(a.length, b.length)
    rows.push({ a: a.padEnd(len, ' '), b: b.padEnd(len, ' '), len })
  }
  return rows
}

// progress 0 → all poem A, 1 → all poem B; the wavefront scrambles the seam.
function charAt(row, idx, progress, waveWidth, totalChars, posOffset, scrambleRoll) {
  const aCh = row.a[idx]
  const bCh = row.b[idx]
  if (aCh === bCh) return aCh

  const charIndex = posOffset + idx
  const wavePos = progress * (totalChars + waveWidth) - waveWidth / 2
  const delta = charIndex - wavePos
  if (delta < -waveWidth / 2) return bCh
  if (delta > waveWidth / 2) return aCh
  // inside the wavefront: scramble mix
  const r = (scrambleRoll + charIndex) % 7
  if (r < 3) return aCh
  if (r < 5) return bCh
  return SCRAMBLE_CHARS[(scrambleRoll + charIndex * 31) % SCRAMBLE_CHARS.length]
}

export default function SuperpositionText({ contextA, contextB, steer, chosenSide, onCommit, extracting }) {
  const chosenCtx = chosenSide === 'A' ? contextA : (chosenSide === 'B' ? contextB : null)
  const fragStart = chosenCtx?.fragmentLineIndex ?? -1
  const fragEnd = chosenCtx ? fragStart + chosenCtx.fragmentLineCount - 1 : -1
  const alignment = useMemo(() => buildAlignment(contextA, contextB), [contextA, contextB])
  const totalChars = useMemo(
    () => alignment.reduce((s, r) => s + r.len, 0),
    [alignment]
  )

  // Precompute per-char opacity based on distance to nearest fragment char (from either poem).
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
    const N = totalChars
    const dist = new Array(N).fill(Infinity)
    for (const idx of fragSet) dist[idx] = 0
    for (let i = 1; i < N; i++) {
      if (dist[i - 1] + 1 < dist[i]) dist[i] = dist[i - 1] + 1
    }
    for (let i = N - 2; i >= 0; i--) {
      if (dist[i + 1] + 1 < dist[i]) dist[i] = dist[i + 1] + 1
    }
    const sizeFactor = Math.min(1, totalChars / 400)
    const CLEAR = 45 * sizeFactor
    const FADE_TO_ZERO = 170 * sizeFactor
    return dist.map(d => {
      if (d <= CLEAR) return 1
      if (d >= FADE_TO_ZERO) return 0
      const t = (d - CLEAR) / (FADE_TO_ZERO - CLEAR)
      return Math.max(0, 1 - t * t * (3 - 2 * t))
    })
  }, [alignment, contextA, contextB, totalChars])

  // The rAF loop publishes each frame through state; refs hold only the
  // loop's own continuity (previous lean, dwell timer, held direction).
  const [frame, setFrame] = useState({ lean: 0, scramble: 0, settled: null })

  const leanRef = useRef(0)
  const committedRef = useRef(false)
  const dwellRef = useRef(0)
  const steerRef = useRef(0)
  const onCommitRef = useRef(onCommit)
  useEffect(() => { onCommitRef.current = onCommit }, [onCommit])
  useEffect(() => { steerRef.current = steer ?? 0 }, [steer])

  useEffect(() => {
    let raf = 0
    let cancelled = false
    let lastTime = performance.now()
    const loop = () => {
      if (cancelled || committedRef.current) return
      const now = performance.now()
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      const s = steerRef.current
      let lean = leanRef.current

      if (s !== 0) {
        lean = Math.max(-1, Math.min(1, lean + s * STEER_RATE * dt))
        if (lean * s >= COMMIT_AT) {
          dwellRef.current += dt * 1000
          if (dwellRef.current >= COMMIT_DWELL_MS) {
            committedRef.current = true
            leanRef.current = s
            document.documentElement.style.setProperty('--lean', String(s))
            setFrame({ lean: s, scramble: 0, settled: s > 0 ? 'B' : 'A' })
            if (onCommitRef.current) onCommitRef.current(s > 0 ? 'B' : 'A')
            return
          }
        } else {
          dwellRef.current = 0
        }
      } else {
        const breathe = Math.sin((now / BREATHE_PERIOD_MS) * Math.PI * 2) * BREATHE_AMPL
        lean += (breathe - lean) * Math.min(1, RELAX_RATE * dt)
        dwellRef.current = 0
      }

      leanRef.current = lean
      document.documentElement.style.setProperty('--lean', lean.toFixed(3))
      setFrame({ lean, scramble: Math.floor(now / 40), settled: null })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelled = true
      if (raf) cancelAnimationFrame(raf)
      document.documentElement.style.setProperty('--lean', '0')
    }
  }, [alignment])

  // If chosenSide arrives from above, pin to the chosen poem.
  const settledSide = chosenSide ?? frame.settled
  const progress = (frame.lean + 1) / 2
  const scrambleRoll = frame.scramble
  const waveWidth = Math.max(14, totalChars * 0.1)

  // Bucket opacity into 8 levels, group consecutive same-bucket chars into spans.
  const bucket = (o) => Math.round(o * 7) / 7
  const rowOffsets = []
  alignment.reduce((pos, row) => { rowOffsets.push(pos); return pos + row.len }, 0)
  const rendered = alignment.map((row, ri) => {
    const posOffset = rowOffsets[ri]
    const segments = []
    let curOpacity = null
    let curText = ''
    let joined = ''
    for (let i = 0; i < row.len; i++) {
      let ch
      if (settledSide === 'A') ch = row.a[i]
      else if (settledSide === 'B') ch = row.b[i]
      else ch = charAt(row, i, progress, waveWidth, totalChars, posOffset, scrambleRoll)
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
    return { segments, joined }
  })


  return (
    <div className={`superposition-text ${extracting ? 'is-extracting' : ''}`}>
      {rendered.map((row, i) => {
        const line = row.joined
        const isFragmentLine = extracting && i >= fragStart && i <= fragEnd
        if (!extracting) {
          return (
            <div key={i} className="superposition-line">
              {row.segments.length === 0 ? ' ' : row.segments.map((seg, si) => (
                <span key={si} style={{ opacity: seg.opacity }}>{seg.text}</span>
              ))}
            </div>
          )
        }
        if (!isFragmentLine) {
          return <div key={i} className="superposition-line is-dissolving">{line || ' '}</div>
        }
        const rangeIdx = i - fragStart
        const range = chosenCtx?.fragmentCharRanges?.[rangeIdx]
        if (!range) {
          return <div key={i} className="superposition-line is-fragment">{line || ' '}</div>
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
