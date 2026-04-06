import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'

// Timing
const HOLD_MS = 2200
const MORPH_MS = 1000
const SETTLE_MS = 400

const SCRAMBLE = 'abcdefghijklmnopqrstuvwxyz .,'

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

// Compute fog opacity per char: clear around both fragments, fade elsewhere
function buildOpacityMap(alignment, ctxA, ctxB, totalChars) {
  const fragSet = new Set()
  const mark = (ctx, startRow) => {
    if (!ctx?.fragmentCharRanges) return
    let pos = 0
    for (let i = 0; i < alignment.length; i++) {
      if (i >= startRow && i < startRow + ctx.fragmentLineCount) {
        const r = ctx.fragmentCharRanges[i - startRow]
        if (r) for (let c = r[0]; c < r[1]; c++) fragSet.add(pos + c)
      }
      pos += alignment[i].len
    }
  }
  mark(ctxA, ctxA.fragmentLineIndex)
  mark(ctxB, ctxB.fragmentLineIndex)
  const N = totalChars
  const dist = new Array(N).fill(N)
  for (const idx of fragSet) dist[idx] = 0
  for (let i = 1; i < N; i++) if (dist[i - 1] + 1 < dist[i]) dist[i] = dist[i - 1] + 1
  for (let i = N - 2; i >= 0; i--) if (dist[i + 1] + 1 < dist[i]) dist[i] = dist[i + 1] + 1
  const factor = Math.min(1, N / 400)
  const CLEAR = 45 * factor
  const FADE = 170 * factor
  return dist.map(d => {
    if (d <= CLEAR) return 1
    if (d >= FADE) return 0
    const t = (d - CLEAR) / (FADE - CLEAR)
    return Math.max(0, 1 - t * t * (3 - 2 * t))
  })
}

// GPU-rendered morph between two poem contexts. Renders as flat 2D text.
export default function TextMorph({ contextA, contextB, chosenSide, onSettled, extracting, y = 0 }) {
  const alignment = useMemo(() => buildAlignment(contextA, contextB), [contextA, contextB])
  const totalChars = useMemo(() => alignment.reduce((s, r) => s + r.len, 0), [alignment])
  const opacityMap = useMemo(
    () => buildOpacityMap(alignment, contextA, contextB, totalChars),
    [alignment, contextA, contextB, totalChars]
  )
  const chosenCtx = chosenSide === 'A' ? contextA : chosenSide === 'B' ? contextB : null
  const fragStart = chosenCtx?.fragmentLineIndex ?? -1
  const fragEnd = chosenCtx ? fragStart + chosenCtx.fragmentLineCount - 1 : -1

  // State in refs for rAF-driven updates
  const stateRef = useRef({
    phase: 'holdA',
    phaseStart: 0,
    progress: 0,
    scrambleRoll: 0,
    settled: false,
    extractStarted: false,
  })
  const textRefs = useRef([])
  const opacityRefs = useRef([])
  const settledCalledRef = useRef(false)
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled

  // Handle chosenSide change
  useEffect(() => {
    if (chosenSide && !stateRef.current.settled) {
      stateRef.current.settled = true
      const s = stateRef.current
      const showing = (s.phase === 'holdB' || s.phase === 'morphToB') ? 'B' : 'A'
      if (showing === chosenSide) {
        s.phase = chosenSide === 'A' ? 'settledA' : 'settledB'
        if (onSettledRef.current && !settledCalledRef.current) {
          settledCalledRef.current = true
          onSettledRef.current()
        }
      } else {
        s.phase = chosenSide === 'B' ? 'settleToB' : 'settleToA'
        s.phaseStart = -1 // will be set on next frame
      }
    }
  }, [chosenSide])

  useFrame(({ clock }) => {
    const now = clock.elapsedTime * 1000
    const s = stateRef.current
    if (s.phaseStart === -1) s.phaseStart = now

    const elapsed = now - s.phaseStart
    s.scrambleRoll = Math.floor(now / 40)

    // Phase machine
    if (s.phase === 'settleToA' || s.phase === 'settleToB') {
      s.progress = Math.min(1, elapsed / SETTLE_MS)
      if (s.progress >= 1) {
        s.phase = s.phase === 'settleToA' ? 'settledA' : 'settledB'
        if (onSettledRef.current && !settledCalledRef.current) {
          settledCalledRef.current = true
          onSettledRef.current()
        }
      }
    } else if (s.phase === 'holdA' || s.phase === 'holdB') {
      s.progress = 0
      if (elapsed >= HOLD_MS) { s.phase = s.phase === 'holdA' ? 'morphToB' : 'morphToA'; s.phaseStart = now }
    } else if (s.phase === 'morphToB' || s.phase === 'morphToA') {
      s.progress = Math.min(1, elapsed / MORPH_MS)
      if (s.progress >= 1) { s.phase = s.phase === 'morphToB' ? 'holdB' : 'holdA'; s.phaseStart = now; s.progress = 0 }
    }

    // Compute displayed text per row and update Text objects
    const waveWidth = Math.max(12, totalChars * 0.08)
    let posOffset = 0
    for (let ri = 0; ri < alignment.length; ri++) {
      const row = alignment[ri]
      let lineStr = ''
      for (let ci = 0; ci < row.len; ci++) {
        const aCh = row.a[ci], bCh = row.b[ci]
        let ch
        if (s.phase === 'holdA' || s.phase === 'settledA') ch = aCh
        else if (s.phase === 'holdB' || s.phase === 'settledB') ch = bCh
        else {
          const dir = (s.phase === 'morphToB' || s.phase === 'settleToB') ? 1 : -1
          const charIdx = posOffset + ci
          const wavePos = s.progress * (totalChars + waveWidth) - waveWidth / 2
          const delta = charIdx - wavePos
          if (aCh === bCh) ch = aCh
          else if (dir === 1) {
            ch = delta < -waveWidth / 2 ? bCh : delta > waveWidth / 2 ? aCh
              : (((s.scrambleRoll + charIdx) % 7) < 3 ? aCh : ((s.scrambleRoll + charIdx) % 7) < 5 ? bCh
                : SCRAMBLE[(s.scrambleRoll + charIdx * 31) % SCRAMBLE.length])
          } else {
            ch = delta < -waveWidth / 2 ? aCh : delta > waveWidth / 2 ? bCh
              : (((s.scrambleRoll + charIdx) % 7) < 3 ? bCh : ((s.scrambleRoll + charIdx) % 7) < 5 ? aCh
                : SCRAMBLE[(s.scrambleRoll + charIdx * 31) % SCRAMBLE.length])
          }
        }

        // During extraction, hide non-fragment chars
        if (extracting) {
          const isFragLine = ri >= fragStart && ri <= fragEnd
          if (!isFragLine) ch = ' '
          else {
            const rangeIdx = ri - fragStart
            const range = chosenCtx?.fragmentCharRanges?.[rangeIdx]
            if (range && (ci < range[0] || ci >= range[1])) ch = ' '
          }
        }

        lineStr += ch
      }

      // Compute line opacity from fog map (average of char opacities)
      let avgOpacity = 0
      for (let ci = 0; ci < row.len; ci++) avgOpacity += (opacityMap[posOffset + ci] ?? 1)
      avgOpacity = row.len > 0 ? avgOpacity / row.len : 1
      if (extracting) {
        const isFragLine = ri >= fragStart && ri <= fragEnd
        avgOpacity = isFragLine ? 1 : 0
      }

      // Update the Text element
      if (textRefs.current[ri]) {
        textRefs.current[ri].text = lineStr
      }
      if (opacityRefs.current[ri]) {
        opacityRefs.current[ri].opacity = avgOpacity
      }
      posOffset += row.len
    }
  })

  const lineHeight = 0.45
  const startY = y + (alignment.length * lineHeight) / 2

  return (
    <group>
      {alignment.map((row, i) => (
        <Text
          key={i}
          ref={el => { textRefs.current[i] = el }}
          position={[0, startY - i * lineHeight, 0]}
          fontSize={0.28}
          color="#1a1a1a"
          anchorX="center"
          anchorY="middle"
          maxWidth={12}
        >
          {row.a}
          <meshBasicMaterial
            ref={el => { opacityRefs.current[i] = el }}
            transparent
            opacity={1}
          />
        </Text>
      ))}
    </group>
  )
}
