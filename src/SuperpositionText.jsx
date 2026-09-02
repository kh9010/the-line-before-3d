import { useState, useEffect, useRef, useMemo } from 'react'

// Focus-pull superposition: both poems occupy the same space, stacked on top
// of each other. The lean pulls one into focus — sharper, darker, slightly
// forward — while the other blurs and recedes behind it, so the response to
// held pressure is continuous physical change, not character substitution.
// At rest the pair breathes: dominance drifts slowly from one poem to the
// other. Holding a pole steers focus toward that poem; holding all the way
// commits.
const STEER_RATE = 0.7         // lean units/sec while holding
const RELAX_RATE = 0.8         // ease/sec back toward the breathing drift
const BREATHE_AMPL = 0.45
const BREATHE_PERIOD_MS = 9000
const COMMIT_AT = 0.93         // |lean| needed to commit
const COMMIT_DWELL_MS = 250    // held at the pole this long → committed

// iA Writer export artifacts — never show them. A space keeps every
// fragmentCharRange index valid.
const cleanLine = (s) => s.replace(/[/\\]/g, ' ')

// Per-line fog segments for one poem layer: chars near the fragment are
// clear, edges dissolve. Static per context, so computed once.
function buildFog(ctx) {
  const lines = (ctx.contextLines ?? []).map(cleanLine)
  const lens = lines.map(l => l.length)
  const total = lens.reduce((a, b) => a + b, 0)
  const offsets = []
  lens.reduce((p, l) => { offsets.push(p); return p + l }, 0)

  const dist = new Array(total).fill(Infinity)
  const rowStart = ctx.fragmentLineIndex
  for (let i = 0; i < lines.length; i++) {
    if (i >= rowStart && i < rowStart + ctx.fragmentLineCount) {
      const r = ctx.fragmentCharRanges?.[i - rowStart]
      if (r) for (let c = r[0]; c < Math.min(r[1], lens[i]); c++) dist[offsets[i] + c] = 0
    }
  }
  for (let i = 1; i < total; i++) {
    if (dist[i - 1] + 1 < dist[i]) dist[i] = dist[i - 1] + 1
  }
  for (let i = total - 2; i >= 0; i--) {
    if (dist[i + 1] + 1 < dist[i]) dist[i] = dist[i + 1] + 1
  }
  const sizeFactor = Math.min(1, total / 400)
  const CLEAR = 45 * sizeFactor
  const FADE_TO_ZERO = 170 * sizeFactor
  const opacity = dist.map(d => {
    if (d <= CLEAR) return 1
    if (d >= FADE_TO_ZERO) return 0
    const t = (d - CLEAR) / (FADE_TO_ZERO - CLEAR)
    return Math.max(0, 1 - t * t * (3 - 2 * t))
  })

  const bucket = (o) => Math.round(o * 7) / 7
  const segments = lines.map((line, li) => {
    const segs = []
    let curOpacity = null
    let curText = ''
    for (let i = 0; i < line.length; i++) {
      const o = bucket(opacity[offsets[li] + i] ?? 1)
      if (curOpacity === null) curOpacity = o
      if (o !== curOpacity) {
        segs.push({ text: curText, opacity: curOpacity })
        curText = ''
        curOpacity = o
      }
      curText += line[i]
    }
    if (curText) segs.push({ text: curText, opacity: curOpacity ?? 1 })
    return segs
  })
  return { lines, segments }
}

function Layer({ ctx, focus, extracting, hidden }) {
  const fog = useMemo(() => buildFog(ctx), [ctx])

  if (hidden) return null

  const f = Math.max(0, Math.min(1, focus))
  const style = extracting ? undefined : {
    opacity: 0.1 + 0.9 * Math.pow(f, 1.4),
    filter: `blur(${((1 - f) * 3.2).toFixed(2)}px)`,
    transform: `translateY(${((1 - f) * -8).toFixed(1)}px) scale(${(0.97 + 0.03 * f).toFixed(3)})`,
  }

  const fragStart = ctx.fragmentLineIndex
  const fragEnd = fragStart + ctx.fragmentLineCount - 1

  return (
    <div className={`superposition-text ${extracting ? 'is-extracting' : ''}`} style={style}>
      {fog.lines.map((line, i) => {
        if (!extracting) {
          return (
            <div key={i} className="superposition-line">
              {fog.segments[i].length === 0 ? ' ' : fog.segments[i].map((seg, si) => (
                <span key={si} style={{ opacity: seg.opacity }}>{seg.text}</span>
              ))}
            </div>
          )
        }
        if (i < fragStart || i > fragEnd) {
          return <div key={i} className="superposition-line is-dissolving">{line || ' '}</div>
        }
        const range = ctx.fragmentCharRanges?.[i - fragStart]
        if (!range) {
          return <div key={i} className="superposition-line is-fragment">{line || ' '}</div>
        }
        const [s, e] = range
        return (
          <div key={i} className="superposition-line is-fragment-line">
            <span className="is-dissolving">{line.slice(0, s)}</span>
            <span className="is-fragment">{line.slice(s, e)}</span>
            <span className="is-dissolving">{line.slice(e)}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function SuperpositionText({ contextA, contextB, steer, chosenSide, onCommit, extracting }) {
  // The rAF loop publishes each frame through state; refs hold only the
  // loop's own continuity (previous lean, dwell timer, held direction).
  const [frame, setFrame] = useState({ lean: 0, settled: null })

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
            setFrame({ lean: s, settled: s > 0 ? 'B' : 'A' })
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
      setFrame({ lean, settled: null })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelled = true
      if (raf) cancelAnimationFrame(raf)
      document.documentElement.style.setProperty('--lean', '0')
    }
  }, [contextA, contextB])

  // If chosenSide arrives from above, pin to the chosen poem.
  const settledSide = chosenSide ?? frame.settled
  const lean = settledSide === 'A' ? -1 : settledSide === 'B' ? 1 : frame.lean
  const focusB = (lean + 1) / 2

  return (
    <div className="superposition-stack">
      <Layer
        ctx={contextA}
        focus={1 - focusB}
        extracting={extracting && settledSide === 'A'}
        hidden={settledSide != null && settledSide !== 'A'}
      />
      <Layer
        ctx={contextB}
        focus={focusB}
        extracting={extracting && settledSide === 'B'}
        hidden={settledSide != null && settledSide !== 'B'}
      />
    </div>
  )
}
