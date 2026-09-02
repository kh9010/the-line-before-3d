import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import SuperpositionText from './SuperpositionText'
import PoemLines from './PoemLines'
import { buildSessionLines } from './pairs'

// After a commit, how long the extraction plays in the morph zone before the
// clause's ghost lifts out and travels to the poem.
const EXTRACT_MS = 900

function App() {
  const [phase, setPhase] = useState('idle')
  const [sessionLines, setSessionLines] = useState([])
  const [lineIdx, setLineIdx] = useState(0)
  const [clauseIdx, setClauseIdx] = useState(0)
  const [chosenSide, setChosenSide] = useState(null)
  const [steer, setSteer] = useState(0)
  const [poem, setPoem] = useState([])
  const [morphKey, setMorphKey] = useState(0)
  const timers = useRef([])

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  const addTimer = (fn, ms) => { const id = setTimeout(fn, ms); timers.current.push(id); return id }

  useEffect(() => () => clearTimers(), [])

  const currentLine = sessionLines[lineIdx]
  const currentSlot = currentLine?.clauses[clauseIdx]

  const handleCreate = () => {
    clearTimers()
    const lines = buildSessionLines()
    if (lines.length === 0) return
    setSessionLines(lines)
    setLineIdx(0)
    setClauseIdx(0)
    setChosenSide(null)
    setSteer(0)
    setPoem([])
    setMorphKey(k => k + 1)
    setPhase('reading')
  }

  const handleCommit = useCallback((side) => {
    if (!currentSlot || chosenSide) return
    const pick = side === 'A' ? currentSlot.negPick : currentSlot.posPick
    if (!pick || !pick.phrase) return
    const poleWord = currentLine.poles[side === 'A' ? 0 : 1]
    const li = lineIdx
    const ci = clauseIdx
    setChosenSide(side)
    setSteer(0)
    setPhase('extracting')
    addTimer(() => {
      // Where the glowing fragment sits right now — the ghost departs from here.
      const srcEls = document.querySelectorAll('.superposition-text .is-fragment')
      let fromRect = null
      if (srcEls.length > 0) {
        let left = Infinity, top = Infinity
        srcEls.forEach(el => {
          const r = el.getBoundingClientRect()
          left = Math.min(left, r.left)
          top = Math.min(top, r.top)
        })
        fromRect = { left, top }
      }
      const clause = { id: `${li}-${ci}-${Date.now()}`, text: pick.phrase.text, pole: poleWord, fromRect }
      setPoem(prev => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last && last.lineIdx === li) {
          next[next.length - 1] = { ...last, clauses: [...last.clauses, clause] }
        } else {
          next.push({ id: `line-${li}`, lineIdx: li, clauses: [clause] })
        }
        return next
      })
      if (ci < currentLine.clauses.length - 1) {
        setClauseIdx(ci + 1)
      } else if (li < sessionLines.length - 1) {
        setLineIdx(li + 1)
        setClauseIdx(0)
      } else {
        setPhase('complete')
        return
      }
      setChosenSide(null)
      setMorphKey(k => k + 1)
      setPhase('reading')
    }, EXTRACT_MS)
  }, [currentSlot, currentLine, chosenSide, lineIdx, clauseIdx, sessionLines.length])

  const handleKeep = () => {
    setPhase('kept')
    addTimer(() => {
      clearTimers()
      setPoem([])
      setSessionLines([])
      setLineIdx(0)
      setClauseIdx(0)
      setChosenSide(null)
      setSteer(0)
      setPhase('idle')
    }, 3500)
  }

  const holdProps = (value) => ({
    onPointerDown: (e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setSteer(value) },
    onPointerUp: () => setSteer(0),
    onPointerCancel: () => setSteer(0),
    onContextMenu: (e) => e.preventDefault(),
  })

  const inSession = phase !== 'idle'
  const firstClause = lineIdx === 0 && clauseIdx === 0 && poem.length === 0

  return (
    <div className={`app phase-${phase}`}>
      {/* The poem being co-created — clauses arrive from their source poem */}
      {inSession && (
        <PoemLines poem={poem} fading={phase === 'kept'} />
      )}

      {/* DOM: superposition morph text */}
      <div className="morph-zone">
        {(phase === 'reading' || phase === 'extracting') && currentSlot && (
          <SuperpositionText
            key={morphKey}
            contextA={currentSlot.negPick.context}
            contextB={currentSlot.posPick.context}
            steer={steer}
            chosenSide={chosenSide}
            onCommit={handleCommit}
            extracting={phase === 'extracting'}
          />
        )}
      </div>

      {/* Idle: title + invitation */}
      {phase === 'idle' && (
        <div className="idle-screen">
          <h1 className="title">the line before</h1>
          <p className="tagline">a poem is always being made from other poems</p>
          <button className="btn-main" onClick={handleCreate}>begin</button>
        </div>
      )}

      {/* DOM: controls */}
      <div className="controls">
        {phase === 'idle' && null}
        {phase === 'reading' && currentLine && (
          <div className="choice-column">
            <div className="choice-buttons">
              <button
                className={`btn-axis pole-a ${steer === -1 ? 'is-held' : ''}`}
                disabled={!!chosenSide}
                {...holdProps(-1)}
              >
                {currentLine.poles[0]}
              </button>
              <button
                className={`btn-axis pole-b ${steer === 1 ? 'is-held' : ''}`}
                disabled={!!chosenSide}
                {...holdProps(1)}
              >
                {currentLine.poles[1]}
              </button>
            </div>
            <p className={`steer-hint ${firstClause ? '' : 'is-hidden'}`}>press and hold</p>
          </div>
        )}
        {phase === 'complete' && (
          <button className="btn-main" onClick={handleKeep}>keep</button>
        )}
        {phase === 'kept' && (
          <span className="status-text">kept</span>
        )}
      </div>

      {/* Clause dots, grouped by line */}
      {inSession && phase !== 'kept' && (
        <div className="round-indicator">
          {sessionLines.map((line, li) => (
            <span key={li} className="dot-group">
              {line.clauses.map((_, ci) => {
                const done = phase === 'complete' ||
                  li < lineIdx || (li === lineIdx && ci < clauseIdx)
                const current = phase !== 'complete' && li === lineIdx && ci === clauseIdx
                return (
                  <span
                    key={ci}
                    className={`round-dot ${done ? 'is-filled' : ''} ${current ? 'is-current' : ''}`}
                  />
                )
              })}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default App
