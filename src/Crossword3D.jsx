import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { getBounds } from './crosswordLayout'

const SPACING = 0.5

// Floating letter — always faces camera via Billboard
function FloatingChar({ char, gx, gz, isNew, delay = 0 }) {
  const ref = useRef()
  const startRef = useRef(null)

  useFrame(({ clock }) => {
    if (!ref.current || !isNew) return
    if (startRef.current === null) startRef.current = clock.elapsedTime
    const elapsed = clock.elapsedTime - startRef.current - delay
    if (elapsed < 0) {
      ref.current.scale.set(0, 0, 0)
      return
    }
    const t = Math.min(1, elapsed / 0.5)
    const ease = 1 - Math.pow(1 - t, 3)
    ref.current.scale.set(ease, ease, ease)
    ref.current.position.y = (1 - ease) * 1.2
  })

  if (char === ' ') return null

  return (
    <group ref={ref} position={[gx * SPACING, 0, gz * SPACING]} scale={isNew ? [0, 0, 0] : [1, 1, 1]}>
      <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
        <Text
          fontSize={0.3}
          color={isNew ? '#1a1a1a' : '#888'}
          anchorX="center"
          anchorY="middle"
        >
          {char}
        </Text>
      </Billboard>
    </group>
  )
}

// Auto-rotating camera that keeps everything in frame
function AutoRig({ bounds }) {
  const cx = ((bounds.minX + bounds.maxX) / 2) * SPACING
  const cz = ((bounds.minY + bounds.maxY) / 2) * SPACING
  const extent = Math.max(bounds.width * SPACING, bounds.height * SPACING, 2)
  const dist = extent * 0.9 + 1.5

  useFrame(({ clock, camera }) => {
    const angle = clock.elapsedTime * 0.12
    const targetX = cx + Math.sin(angle) * dist
    const targetZ = cz + Math.cos(angle) * dist
    const targetY = dist * 0.55
    camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.025)
    camera.lookAt(cx, 0, cz)
  })

  return null
}

function Scene({ placements, latestIndex }) {
  const bounds = useMemo(() => getBounds(placements || []), [placements])

  if (!placements || placements.length === 0) return null

  const ox = -((bounds.minX + bounds.maxX) / 2)
  const oz = -((bounds.minY + bounds.maxY) / 2)

  return (
    <>
      <ambientLight intensity={1} />
      <directionalLight position={[3, 6, 3]} intensity={0.3} />

      <AutoRig bounds={bounds} />

      <group position={[ox * SPACING, 0, oz * SPACING]}>
        {placements.map((p, pi) => {
          const isLatest = pi === latestIndex
          const chars = []
          for (let k = 0; k < p.text.length; k++) {
            const gx = p.x + (p.orient === 'h' ? k : 0)
            const gz = p.y + (p.orient === 'v' ? k : 0)
            chars.push(
              <FloatingChar
                key={`${pi}-${k}`}
                char={p.text[k]}
                gx={gx}
                gz={gz}
                isNew={isLatest}
                delay={k * 0.03}
              />
            )
          }
          return <group key={pi}>{chars}</group>
        })}
      </group>
    </>
  )
}

export default function Crossword3D({ placements, latestIndex }) {
  return (
    <div className="crossword-3d-container">
      <Canvas camera={{ position: [0, 4, 5], fov: 45 }} style={{ background: 'transparent' }}>
        <Scene placements={placements} latestIndex={latestIndex} />
      </Canvas>
    </div>
  )
}
