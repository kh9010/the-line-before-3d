import { useMemo } from 'react'
import { getBounds } from './crosswordLayout'

// Render an array of placements as a bananagram/crossword layout.
// Each placement: { text, orient: 'h' | 'v', x, y }
// `latestIndex` is the index of the most recently added placement (for entrance animation).
export default function Crossword({ placements, latestIndex = -1, charSize = 18 }) {
  const bounds = useMemo(() => getBounds(placements || []), [placements])
  if (!placements || placements.length === 0) return null

  const cellW = charSize * 0.62
  const cellH = charSize * 1.1
  const width = bounds.width * cellW
  const height = bounds.height * cellH

  return (
    <div className="crossword" style={{ width, height, fontSize: `${charSize}px` }}>
      {placements.map((p, pi) => {
        const isLatest = pi === latestIndex
        const chars = []
        for (let k = 0; k < p.text.length; k++) {
          const gx = p.x + (p.orient === 'h' ? k : 0)
          const gy = p.y + (p.orient === 'v' ? k : 0)
          const px = (gx - bounds.minX) * cellW
          const py = (gy - bounds.minY) * cellH
          chars.push(
            <span
              key={k}
              className={`crossword-char ${isLatest ? 'is-new' : 'is-settled'}`}
              style={{
                left: `${px}px`,
                top: `${py}px`,
                width: `${cellW}px`,
                height: `${cellH}px`,
                animationDelay: isLatest ? `${k * 0.025}s` : undefined,
              }}
            >
              {p.text[k] === ' ' ? '\u00A0' : p.text[k]}
            </span>
          )
        }
        return <div key={pi} className={`crossword-line orient-${p.orient}`}>{chars}</div>
      })}
    </div>
  )
}
