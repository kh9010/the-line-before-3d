// The co-created poem, replacing the crossword panel. One line per axis;
// each clause materialises in the manner of the pole that pulled it —
// echo reverberates in with decaying afterimages, ignite sparks and cools
// to ink, sublimate condenses out of blur, howl bursts and settles, grip
// clenches inward, release drifts apart, crystallise snaps facet by facet,
// smother rises pressed-flat from under a weight.

const NBSP = '\u00A0'

function displayText(text) {
  return text.replace(/ \/ /g, ' ')
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
  const chars = text.split('')
  const mid = (chars.length - 1) / 2
  return (
    <span className={`clause mat-${clause.pole}`}>
      {clause.pole === 'echo' && (
        <>
          <span className="clause-ghost ghost-1" aria-hidden="true">{text}</span>
          <span className="clause-ghost ghost-2" aria-hidden="true">{text}</span>
        </>
      )}
      {chars.map((ch, i) => (
        <span key={i} className="clause-char" style={charStyle(clause.pole, i, chars.length, mid)}>
          {ch === ' ' ? NBSP : ch}
        </span>
      ))}
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
