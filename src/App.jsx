import { useState, useEffect, useRef, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import './App.css'
import Scene from './Scene'
import { buildSessionPairs } from './pairs'

const TOTAL_ROUNDS = 4

function App() {
  const [phase, setPhase] = useState('idle')
  const [sessionPairs, setSessionPairs] = useState([])
  const [currentRound, setCurrentRound] = useState(0)
  const [chosenSide, setChosenSide] = useState(null)
  const [lines, setLines] = useState([])
  const timers = useRef([])
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  const addTimer = (fn, ms) => { const id = setTimeout(fn, ms); timers.current.push(id); return id }

  // Stable key for TextMorph remount per round
  const [morphKey, setMorphKey] = useState(0)

  useEffect(() => () => clearTimers(), [])

  const currentRoundData = sessionPairs[currentRound]

  const handleCreate = () => {
    clearTimers()
    const pairs = buildSessionPairs()
    if (pairs.length === 0) return
    setSessionPairs(pairs)
    setCurrentRound(0)
    setChosenSide(null)
    setLines([])
    setMorphKey(k => k + 1)
    setPhase('reading')
  }

  const handleChoice = (side) => {
    if (!currentRoundData || chosenSide) return
    const pick = side === 'A' ? currentRoundData.negPick : currentRoundData.posPick
    if (!pick || !pick.phrase) return
    setChosenSide(side)
  }

  const handleSettled = useCallback(() => {
    if (!currentRoundData || !chosenSide) return
    const pick = chosenSide === 'A' ? currentRoundData.negPick : currentRoundData.posPick
    if (!pick) return
    const poleWord = currentRoundData.poles[chosenSide === 'A' ? 0 : 1]
    const round = currentRound
    setPhase('extracting')
    addTimer(() => {
      setLines(prev => [...prev, { text: pick.phrase.text, id: Date.now(), mode: poleWord }])

      if (round < sessionPairs.length - 1) {
        setCurrentRound(r => r + 1)
        setChosenSide(null)
        setMorphKey(k => k + 1)
        setPhase('reading')
      } else {
        setPhase('complete')
      }
    }, 2000)
  }, [currentRoundData, chosenSide, currentRound])

  const handleKeep = () => {
    setPhase('kept')
    addTimer(() => {
      clearTimers()
      setLines([])
      setSessionPairs([])
      setCurrentRound(0)
      setChosenSide(null)
      setPhase('idle')
    }, 3500)
  }

  const inSession = phase !== 'idle'

  return (
    <div className={`app phase-${phase}`}>
      {/* GPU-rendered scene */}
      <div className={`canvas-container ${inSession ? 'is-active' : ''} ${phase === 'kept' ? 'is-fading' : ''}`}>
        <Canvas orthographic camera={{ zoom: 100, position: [0, 0, 10] }}>
          <Scene
            key={morphKey}
            phase={phase}
            currentRoundData={currentRoundData}
            chosenSide={chosenSide}
            lines={lines}
            filledRounds={lines.length}
            onSettled={handleSettled}
            extracting={phase === 'extracting'}
          />
        </Canvas>
      </div>

      {/* HTML overlay for buttons */}
      <div className="overlay">
        <div className="controls">
          {phase === 'idle' && (
            <button className="btn-main" onClick={handleCreate}>begin</button>
          )}
          {phase === 'reading' && currentRoundData && (
            <div className="choice-buttons">
              <button
                className={`btn-axis ${chosenSide === 'A' ? 'is-chosen' : ''}`}
                onClick={() => handleChoice('A')}
                disabled={!!chosenSide}
              >
                {currentRoundData.poles[0]}
              </button>
              <button
                className={`btn-axis ${chosenSide === 'B' ? 'is-chosen' : ''}`}
                onClick={() => handleChoice('B')}
                disabled={!!chosenSide}
              >
                {currentRoundData.poles[1]}
              </button>
            </div>
          )}
          {phase === 'extracting' && (
            <div className="status-text"></div>
          )}
          {phase === 'complete' && (
            <button className="btn-main" onClick={handleKeep}>keep</button>
          )}
          {phase === 'kept' && (
            <div className="status-text">kept</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
