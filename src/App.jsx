import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import SuperpositionText from './SuperpositionText'
import Crossword3D from './Crossword3D'
import { buildSessionPairs } from './pairs'
import { placeFragment } from './crosswordLayout'

const TOTAL_ROUNDS = 4

function App() {
  const [phase, setPhase] = useState('idle')
  const [sessionPairs, setSessionPairs] = useState([])
  const [currentRound, setCurrentRound] = useState(0)
  const [chosenSide, setChosenSide] = useState(null)
  const [lines, setLines] = useState([])
  const [placements, setPlacements] = useState([])
  const [morphKey, setMorphKey] = useState(0)
  const timers = useRef([])

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  const addTimer = (fn, ms) => { const id = setTimeout(fn, ms); timers.current.push(id); return id }

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
    setPlacements([])
    setMorphKey(k => k + 1)
    setPhase('reading')
  }

  const handleChoice = (e, side) => {
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
      setPlacements(prev => placeFragment(prev, pick.phrase.text))
      if (round < sessionPairs.length - 1) {
        setCurrentRound(r => r + 1)
        setChosenSide(null)
        setMorphKey(k => k + 1)
        setPhase('reading')
      } else {
        setPhase('complete')
      }
    }, 2200)
  }, [currentRoundData, chosenSide, currentRound, sessionPairs.length])

  const handleKeep = () => {
    setPhase('kept')
    addTimer(() => {
      clearTimers()
      setLines([])
      setPlacements([])
      setSessionPairs([])
      setCurrentRound(0)
      setChosenSide(null)
      setPhase('idle')
    }, 3500)
  }

  const inSession = phase !== 'idle'

  return (
    <div className={`app phase-${phase}`}>
      {/* 3D crossword — constrained panel, slowly spinning */}
      {inSession && placements.length > 0 && (
        <div className={`crossword-panel ${phase === 'kept' ? 'is-fading' : ''}`}>
          <Crossword3D placements={placements} latestIndex={placements.length - 1} />
        </div>
      )}

      {/* DOM: superposition morph text */}
      <div className="morph-zone">
        {(phase === 'reading' || phase === 'extracting') && currentRoundData && (
          <SuperpositionText
            key={morphKey}
            contextA={currentRoundData.negPick.context}
            contextB={currentRoundData.posPick.context}
            chosenSide={chosenSide}
            onSettled={handleSettled}
            extracting={phase === 'extracting'}
          />
        )}
      </div>

      {/* DOM: controls */}
      <div className="controls">
        {phase === 'idle' && (
          <button className="btn-main" onClick={handleCreate}>begin</button>
        )}
        {phase === 'reading' && currentRoundData && (
          <div className="choice-buttons">
            <button
              className={`btn-axis ${chosenSide === 'A' ? 'is-chosen' : ''}`}
              onClick={(e) => handleChoice(e, 'A')}
              disabled={!!chosenSide}
            >
              {currentRoundData.poles[0]}
            </button>
            <button
              className={`btn-axis ${chosenSide === 'B' ? 'is-chosen' : ''}`}
              onClick={(e) => handleChoice(e, 'B')}
              disabled={!!chosenSide}
            >
              {currentRoundData.poles[1]}
            </button>
          </div>
        )}
        {phase === 'complete' && (
          <button className="btn-main" onClick={handleKeep}>keep</button>
        )}
        {phase === 'kept' && (
          <span className="status-text">kept</span>
        )}
      </div>

      {/* Round dots */}
      {inSession && phase !== 'kept' && (
        <div className="round-indicator">
          {Array.from({ length: Math.min(TOTAL_ROUNDS, sessionPairs.length) }, (_, i) => (
            <span key={i} className={`round-dot ${i < lines.length ? 'is-filled' : ''} ${i === lines.length ? 'is-current' : ''}`} />
          ))}
        </div>
      )}
    </div>
  )
}

export default App
