import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Text, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { getBounds } from './crosswordLayout'

const TILE_W = 0.5
const TILE_D = 0.5
const TILE_H = 0.12
const GAP = 0.04

// Single scrabble-style tile with letter on top
function Tile({ char, gx, gz, isNew, delay = 0 }) {
  const ref = useRef()
  const startRef = useRef(null)

  useFrame(({ clock }) => {
    if (!ref.current || !isNew) return
    if (startRef.current === null) startRef.current = clock.elapsedTime
    const elapsed = clock.elapsedTime - startRef.current - delay
    if (elapsed < 0) {
      ref.current.scale.set(0, 0, 0)
      ref.current.position.y = 2
      return
    }
    const t = Math.min(1, elapsed / 0.5)
    const ease = 1 - Math.pow(1 - t, 3)
    ref.current.scale.set(ease, ease, ease)
    ref.current.position.y = (1 - ease) * 1.5
  })

  if (char === ' ') return null

  const x = gx * (TILE_W + GAP)
  const z = gz * (TILE_D + GAP)

  return (
    <group ref={ref} position={[x, 0, z]} scale={isNew ? [0, 0, 0] : [1, 1, 1]}>
      <mesh position={[0, TILE_H / 2, 0]}>
        <boxGeometry args={[TILE_W, TILE_H, TILE_D]} />
        <meshStandardMaterial
          color={isNew ? '#f8f4ec' : '#e8e4dc'}
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>
      <Text
        position={[0, TILE_H + 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.28}
        color={isNew ? '#1a1a1a' : '#777'}
        anchorX="center"
        anchorY="middle"
      >
        {char}
      </Text>
    </group>
  )
}

// Auto-rotating, auto-framing rig
function AutoRig({ bounds }) {
  const groupRef = useRef()

  // Center point of the crossword
  const cx = ((bounds.minX + bounds.maxX) / 2) * (TILE_W + GAP)
  const cz = ((bounds.minY + bounds.maxY) / 2) * (TILE_D + GAP)

  // Camera distance based on crossword size
  const extent = Math.max(bounds.width * (TILE_W + GAP), bounds.height * (TILE_D + GAP), 3)
  const dist = extent * 1.1

  useFrame(({ clock, camera }) => {
    // Slow orbit
    const angle = clock.elapsedTime * 0.15
    const camX = cx + Math.sin(angle) * dist
    const camZ = cz + Math.cos(angle) * dist
    camera.position.lerp(new THREE.Vector3(camX, dist * 0.7, camZ), 0.03)
    camera.lookAt(cx, 0, cz)
  })

  return null
}

function Scene({ placements, latestIndex }) {
  const bounds = useMemo(() => getBounds(placements || []), [placements])

  if (!placements || placements.length === 0) return null

  // Offset so crossword is centered at origin
  const ox = -((bounds.minX + bounds.maxX) / 2)
  const oz = -((bounds.minY + bounds.maxY) / 2)

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 8, 4]} intensity={0.6} castShadow />
      <pointLight position={[-3, 5, -3]} intensity={0.3} />

      <AutoRig bounds={bounds} />

      <group position={[ox * (TILE_W + GAP), 0, oz * (TILE_D + GAP)]}>
        {placements.map((p, pi) => {
          const isLatest = pi === latestIndex
          const tiles = []
          for (let k = 0; k < p.text.length; k++) {
            const gx = p.x + (p.orient === 'h' ? k : 0)
            const gz = p.y + (p.orient === 'v' ? k : 0)
            tiles.push(
              <Tile
                key={`${pi}-${k}`}
                char={p.text[k]}
                gx={gx}
                gz={gz}
                isNew={isLatest}
                delay={k * 0.03}
              />
            )
          }
          return <group key={pi}>{tiles}</group>
        })}
      </group>

      {/* Ground shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#f0ece4" roughness={1} />
      </mesh>
    </>
  )
}

export default function Crossword3D({ placements, latestIndex }) {
  return (
    <div className="crossword-3d-container">
      <Canvas shadows camera={{ position: [0, 5, 5], fov: 45 }}>
        <Scene placements={placements} latestIndex={latestIndex} />
      </Canvas>
    </div>
  )
}
