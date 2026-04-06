import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Text, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { getBounds } from './crosswordLayout'

const CELL_W = 0.55
const CELL_H = 0.8
const STREET_Y = 0   // ground plane

// One character in 3D space
function CharBlock({ char, x, z, isNew, delay = 0 }) {
  const meshRef = useRef()
  const startTime = useRef(null)
  const isSpace = char === ' '

  useFrame(({ clock }) => {
    if (!meshRef.current || !isNew) return
    if (startTime.current === null) startTime.current = clock.elapsedTime
    const elapsed = clock.elapsedTime - startTime.current - delay
    if (elapsed < 0) {
      meshRef.current.scale.set(0, 0, 0)
      return
    }
    const t = Math.min(1, elapsed / 0.5)
    const ease = 1 - Math.pow(1 - t, 3)
    meshRef.current.scale.set(ease, ease, ease)
    meshRef.current.position.y = STREET_Y + (1 - ease) * 1.5
  })

  if (isSpace) return null

  return (
    <group ref={meshRef} position={[x * CELL_W, STREET_Y, z * CELL_H]} scale={isNew ? [0, 0, 0] : [1, 1, 1]}>
      {/* Letter base block */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[CELL_W * 0.85, 0.3, CELL_H * 0.85]} />
        <meshStandardMaterial color={isNew ? '#1a1a1a' : '#888'} />
      </mesh>
      {/* Letter text on top */}
      <Text
        position={[0, 0.32, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.35}
        color={isNew ? '#fff' : '#ddd'}
        anchorX="center"
        anchorY="middle"
        font="/fonts/courier.woff"
      >
        {char}
      </Text>
    </group>
  )
}

// The ground plane — extends as the map grows
function Ground({ bounds }) {
  const w = (bounds.width + 4) * CELL_W
  const h = (bounds.height + 4) * CELL_H
  const cx = ((bounds.minX + bounds.maxX) / 2) * CELL_W
  const cz = ((bounds.minY + bounds.maxY) / 2) * CELL_H
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.01, cz]}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial color="#f5f0e8" />
    </mesh>
  )
}

// Camera that smoothly follows the latest placement
function CameraRig({ target }) {
  const { camera } = useThree()
  const targetRef = useRef(new THREE.Vector3(0, 5, 4))
  const lookRef = useRef(new THREE.Vector3(0, 0, 0))

  useEffect(() => {
    if (target) {
      targetRef.current.set(target.x * CELL_W, 6, target.z * CELL_H + 5)
      lookRef.current.set(target.x * CELL_W, 0, target.z * CELL_H)
    }
  }, [target])

  useFrame(() => {
    camera.position.lerp(targetRef.current, 0.02)
    const look = new THREE.Vector3().copy(camera.position)
    look.lerp(lookRef.current, 0.02)
    camera.lookAt(lookRef.current)
  })

  return null
}

// Main 3D scene
function Scene({ placements, latestIndex }) {
  const bounds = useMemo(() => getBounds(placements || []), [placements])

  // Compute camera target from latest placement center
  const cameraTarget = useMemo(() => {
    if (!placements || placements.length === 0) return null
    const latest = placements[placements.length - 1]
    const midK = Math.floor(latest.text.length / 2)
    return {
      x: latest.x + (latest.orient === 'h' ? midK : 0),
      z: latest.y + (latest.orient === 'v' ? midK : 0),
    }
  }, [placements])

  if (!placements || placements.length === 0) return null

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />
      <pointLight position={[0, 4, 0]} intensity={0.4} />

      <Ground bounds={bounds} />

      {placements.map((p, pi) => {
        const isLatest = pi === latestIndex
        const chars = []
        for (let k = 0; k < p.text.length; k++) {
          const gx = p.x + (p.orient === 'h' ? k : 0)
          const gz = p.y + (p.orient === 'v' ? k : 0)
          chars.push(
            <CharBlock
              key={`${pi}-${k}`}
              char={p.text[k]}
              x={gx - bounds.minX}
              z={gz - bounds.minY}
              isNew={isLatest}
              delay={k * 0.04}
            />
          )
        }
        return <group key={pi}>{chars}</group>
      })}

      <CameraRig target={cameraTarget} />
      <OrbitControls enablePan={true} enableZoom={true} maxPolarAngle={Math.PI / 2.2} />
    </>
  )
}

export default function CrosswordScene({ placements, latestIndex }) {
  return (
    <div className="crossword-3d">
      <Canvas camera={{ position: [0, 8, 8], fov: 50 }}>
        <Scene placements={placements} latestIndex={latestIndex} />
      </Canvas>
    </div>
  )
}
