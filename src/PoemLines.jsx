// The co-created poem, replacing the crossword panel. One line per axis;
// each clause materialises in the manner of the pole that pulled it —
// echo reverberates in with decaying afterimages, ignite sparks and cools
// to ink, sublimate condenses out of blur, howl bursts and settles, grip
// clenches inward, release drifts apart, crystallise snaps facet by facet,
// smother rises pressed-flat from under a weight.


import { useState, useEffect, useRef } from 'react'

// Slashes and backslashes in fragment text are iA Writer export artifacts.
function displayText(text) {
  return text.replace(/\s*[/\\]+\s*/g, ' ').trim()
}

// Per-character animation vars for each pole style.
function charStyle(pole, i, len, mid) {
  switch (pole) {
    case 'sublimate':
      return { animationDelay: `${i * 0.07}s` }
    case 'crystallise':
      return { animationDelay: `${i * 0.045}s` }
    case 'grip':
      // no stagger — the whole clause clenches at once, chars pulled in from outside
      return { '--dx': `${(i - mid) * 8}px` }
    case 'release':
      // starts compressed at the centre, eases apart into natural spacing
      return { '--dx': `${(i - mid) * 8}px`, animationDelay: `${Math.abs(i - mid) * 0.035}s` }
    case 'echo':
      return { animationDelay: `${i * 0.04}s` }
    case 'ignite':
      // sparks catch in pseudo-random order, not left-to-right
      return { animationDelay: `${(((i * 7) % len) / len) * 0.4}s` }
    case 'smother':
      return { animationDelay: `${i * 0.05}s` }
    case 'howl':
      return { '--rot': `${((i * 13) % 7) - 3}deg`, animationDelay: `${i * 0.028}s` }
    default:
      return { animationDelay: `${i * 0.05}s` }
  }
}

function Clause({ clause }) {
  const text = displayText(clause.text)
  const words = text.split(' ')
  const len = text.length
  const mid = (len - 1) / 2
  const ref = useRef(null)
  // When the clause carries fromRect (where its fragment sat in the morph
  // zone), a ghost of the text travels from there to its place in this poem;
  // the pole materialisation plays as it lands. One continuous journey:
  // out of the old poem, into this one.
  const [landed, setLanded] = useState(!clause.fromRect)
  useEffect(() => {
    if (landed || !clause.fromRect) return
    const el = ref.current
    const target = el?.getBoundingClientRect()
    if (!target || !target.width) {
      const raf = requestAnimationFrame(() => setLanded(true))
      return () => cancelAnimationFrame(raf)
    }
    const ghost = document.createElement('div')
    ghost.className = 'travel-ghost'
    ghost.textContent = displayText(clause.text)
    ghost.style.left = `${target.left}px`
    ghost.style.top = `${target.top}px`
    document.body.appendChild(ghost)
    const dx = clause.fromRect.left - target.left
    const dy = clause.fromRect.top - target.top
    const travel = ghost.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)`, opacity: 0.95 },
        { transform: 'translate(0, 0)', opacity: 1 },
      ],
      { duration: 750, easing: 'cubic-bezier(0.25, 0.6, 0.3, 1)' }
    )
    let done = false
    travel.onfinish = () => {
      if (done) return
      setLanded(true)
      const fade = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' })
      fade.onfinish = () => { done = true; ghost.remove() }
    }
    return () => { done = true; travel.cancel(); ghost.remove() }
  }, [landed, clause])
  // Chars are grouped into word spans so a clause too wide for the screen
  // wraps at word boundaries, never mid-word. Delays still use the char's
  // index in the full clause so the timing reads as one gesture.
  const starts = []
  words.reduce((pos, word) => { starts.push(pos); return pos + word.length + 1 }, 0)
  // A clause that travelled here lands and settles in its pole's character —
  // full text from the first frame, no re-materialisation from nothing.
  const phaseClass = landed ? (clause.fromRect ? 'did-travel' : '') : 'is-arriving'
  return (
    <span ref={ref} className={`clause mat-${clause.pole} ${phaseClass}`}>
      {landed && clause.pole === 'echo' && (
        <>
          <span className="clause-ghost ghost-1" aria-hidden="true">{text}</span>
          <span className="clause-ghost ghost-2" aria-hidden="true">{text}</span>
        </>
      )}
      {words.map((word, wi) => {
        const start = starts[wi]
        return (
          <span key={wi}>
            <span className="clause-word">
              {word.split('').map((ch, ci) => (
                <span key={ci} className="clause-char" style={charStyle(clause.pole, start + ci, len, mid)}>
                  {ch}
                </span>
              ))}
            </span>
            {wi < words.length - 1 && ' '}
          </span>
        )
      })}
    </span>
  )
}

export default function PoemLines({ poem, fading }) {
  if (poem.length === 0) return null
  return (
    <div className={`poem-panel ${fading ? 'is-fading' : ''}`}>
      {poem.map(line => (
        <div key={line.id} className="poem-line">
          {line.clauses.map(cl => (
            <Clause key={cl.id} clause={cl} />
          ))}
        </div>
      ))}
    </div>
  )
}
