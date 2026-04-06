import { useState, useEffect, useRef } from 'react'
import './App.css'
import CrosswordScene from './CrosswordScene'
import { buildSessionPairs } from './pairs'
import { placeFragment } from './crosswordLayout'

const TOTAL_ROUNDS = 4

function App() {
  const [phase, setPhase] = useState('idle')
  const [sessionPairs, setSessionPairs] = useState([])
  const [currentRound, setCurrentRound] = useState(0)
  const [chosenSide, setChosenSide] = useState(null)
  const [placements, setPlacements] = useState([])
  const timers = useRef([])
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  const addTimer = (fn, ms) => { const id = setTimeout(fn, ms); timers.current.push(id); return id }

  useEffect(() => () => clearTimers(), [])

  const currentRoundData = sessionPairs[currentRound]

  const handleCreate = () => {
    clearTimers()
    const pairs = buildSessionPairs()
    setSessionPairs(pairs)
    setCurrentRound(0)
    setChosenSide(null)
    setPlacements([])
    setPhase('reading')
  }

  const handleChoice = (side) => {
    if (!currentRoundData || chosenSide) return
    const pick = side === 'A' ? currentRoundData.negPick : currentRoundData.posPick
    if (!pick || !pick.phrase) return
    setChosenSide(side)
    const round = currentRound
    addTimer(() => {
      setPhase('extracting')
      addTimer(() => {
        setPlacements(prev => placeFragment(prev, pick.phrase.text))
        if (round < TOTAL_ROUNDS - 1) {
          setCurrentRound(r => r + 1)
          setChosenSide(null)
          setPhase('reading')
        } else {
          setPhase('complete')
        }
      }, 1200)
    }, 800)
  }

  const handleKeep = () => {
    setPhase('kept')
    addTimer(() => {
      clearTimers()
      setPlacements([])
      setSessionPairs([])
      setCurrentRound(0)
      setChosenSide(null)
      setPhase('idle')
    }, 4000)
  }

  const inSession = phase !== 'idle'

  // Current round's source context for display
  const chosenCtx = currentRoundData && chosenSide
    ? (chosenSide === 'A' ? currentRoundData.negPick?.context : currentRoundData.posPick?.context)
    : null
  const readingCtxA = currentRoundData?.negPick?.context
  const readingCtxB = currentRoundData?.posPick?.context

  return (
    <div className={`app phase-${phase}`}>
      {/* 3D crossword — always visible during session */}
      <div className={`scene-container ${inSession ? 'is-active' : ''} ${phase === 'kept' ? 'is-fading' : ''}`}>
        {inSession && <CrosswordScene placements={placements} latestIndex={placements.length - 1} />}
      </div>

      {/* Overlay: source text + controls */}
      <div className="overlay">
        {/* Source context excerpt during reading */}
        {(phase === 'reading' || phase === 'extracting') && readingCtxA && (
          <div className={`source-excerpt ${chosenSide ? 'is-settling' : ''}`}>
            {(chosenSide === 'A' ? readingCtxA : chosenSide === 'B' ? readingCtxB : readingCtxA)
              .contextLines.map((line, i) => (
                <p key={i} className="source-line">{line || '\u00A0'}</p>
              ))}
          </div>
        )}

        {/* Controls */}
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
            <div className="status-text">placing fragment...</div>
          )}
          {phase === 'complete' && (
            <button className="btn-main" onClick={handleKeep}>keep</button>
          )}
          {phase === 'kept' && (
            <div className="status-text">kept</div>
          )}
        </div>

        {/* Round indicator */}
        {inSession && phase !== 'kept' && (
          <div className="round-indicator">
            {Array.from({ length: TOTAL_ROUNDS }, (_, i) => (
              <span key={i} className={`round-dot ${i < placements.length ? 'is-filled' : ''} ${i === placements.length ? 'is-current' : ''}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
