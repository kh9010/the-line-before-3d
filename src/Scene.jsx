import { Text } from '@react-three/drei'
import TextMorph from './TextMorph'
import CrosswordView from './CrosswordView'

// Chosen-stack lines rendered as GPU text
function ChosenStack({ lines, y = 2.5 }) {
  const lineHeight = 0.4
  return (
    <group>
      {lines.map((line, i) => {
        const opacity = Math.max(0.3, 0.35 + (i / 4) * 0.35)
        return (
          <Text
            key={line.id}
            position={[0, y - i * lineHeight, 0]}
            fontSize={0.22}
            color="#2a2a2a"
            anchorX="center"
            anchorY="middle"
            maxWidth={10}
          >
            {line.text.replace(/ \/ /g, '\n')}
            <meshBasicMaterial transparent opacity={opacity} />
          </Text>
        )
      })}
    </group>
  )
}

// Round dots
function RoundDots({ total, filled, y = -2.8 }) {
  const spacing = 0.3
  const startX = -((total - 1) * spacing) / 2
  return (
    <group>
      {Array.from({ length: total }, (_, i) => (
        <mesh key={i} position={[startX + i * spacing, y, 0]}>
          <circleGeometry args={[0.05, 16]} />
          <meshBasicMaterial color={i < filled ? '#555' : i === filled ? '#1a1a1a' : '#ddd'} />
        </mesh>
      ))}
    </group>
  )
}

export default function Scene({ phase, currentRoundData, chosenSide, lines, placements, filledRounds = 0, onSettled, extracting }) {
  return (
    <>
      {/* Crossword grows as fragments are chosen */}
      {placements && placements.length > 0 && (
        <CrosswordView placements={placements} latestIndex={placements.length - 1} y={2} />
      )}

      {/* Chosen lines stack at top (hidden when crossword active) */}
      {(!placements || placements.length === 0) && <ChosenStack lines={lines} y={2.8} />}

      {/* Superposition morph in center */}
      {(phase === 'reading' || phase === 'extracting') && currentRoundData && (
        <TextMorph
          contextA={currentRoundData.negPick.context}
          contextB={currentRoundData.posPick.context}
          chosenSide={chosenSide}
          onSettled={onSettled}
          extracting={extracting}
          y={0}
        />
      )}

      {/* Round indicator */}
      {phase !== 'idle' && phase !== 'kept' && (
        <RoundDots total={4} filled={filledRounds} y={-3} />
      )}
    </>
  )
}
