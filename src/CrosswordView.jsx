import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { getBounds } from './crosswordLayout'

const BASE_CELL_W = 0.32
const BASE_CELL_H = 0.38

// A single letter tile rendered as GPU text
function CharTile({ char, x, y, cellW, cellH, fontSize, isNew, delay = 0 }) {
  const ref = useRef()
  const startRef = useRef(null)

  useFrame(({ clock }) => {
    if (!ref.current) return
    if (!isNew) {
      ref.current.fillOpacity = 0.5
      return
    }
    if (startRef.current === null) startRef.current = clock.elapsedTime
    const elapsed = clock.elapsedTime - startRef.current - delay
    if (elapsed < 0) {
      ref.current.fillOpacity = 0
      return
    }
    const t = Math.min(1, elapsed / 0.4)
    ref.current.fillOpacity = t
  })

  if (char === ' ') return null

  return (
    <Text
      ref={ref}
      position={[x * cellW, -y * cellH, 0]}
      fontSize={fontSize}
      color="#1a1a1a"
      anchorX="center"
      anchorY="middle"
      fillOpacity={isNew ? 0 : 0.5}
    >
      {char}
    </Text>
  )
}

// 2D crossword rendered in the orthographic scene.
// Auto-scales to fit within the available viewport area.
export default function CrosswordView({ placements, latestIndex, y = 0 }) {
  const bounds = useMemo(() => getBounds(placements || []), [placements])
  const { viewport } = useThree()

  if (!placements || placements.length === 0) return null

  // Available area for crossword (top portion of screen)
  const maxW = viewport.width * 0.85
  const maxH = viewport.height * 0.35

  // Compute scale factor so crossword fits
  const rawW = bounds.width * BASE_CELL_W
  const rawH = bounds.height * BASE_CELL_H
  const scale = Math.min(1, maxW / Math.max(rawW, 0.1), maxH / Math.max(rawH, 0.1))

  const cellW = BASE_CELL_W * scale
  const cellH = BASE_CELL_H * scale
  const fontSize = 0.24 * scale

  // Center the crossword horizontally
  const offsetX = -((bounds.width - 1) * cellW) / 2
  const offsetY = ((bounds.height - 1) * cellH) / 2

  return (
    <group position={[offsetX, y + offsetY, 0]}>
      {placements.map((p, pi) => {
        const isLatest = pi === latestIndex
        const tiles = []
        for (let k = 0; k < p.text.length; k++) {
          const gx = p.x + (p.orient === 'h' ? k : 0) - bounds.minX
          const gy = p.y + (p.orient === 'v' ? k : 0) - bounds.minY
          tiles.push(
            <CharTile
              key={`${pi}-${k}`}
              char={p.text[k]}
              x={gx}
              y={gy}
              cellW={cellW}
              cellH={cellH}
              fontSize={fontSize}
              isNew={isLatest}
              delay={k * 0.03}
            />
          )
        }
        return <group key={pi}>{tiles}</group>
      })}
    </group>
  )
}
