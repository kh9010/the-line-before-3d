import { isMobile } from './helpers'

const particleConfigs = {
  sublimate:   { count: 16, className: 'particle-sublimate', lifetime: 3000 },
  crystallise: { count: 18, className: 'particle-crystallise', lifetime: 800 },
  grip:        { count: 14, className: 'particle-grip', lifetime: 1200 },
  release:     { count: 12, className: 'particle-release', lifetime: 3500 },
  echo:        { count: 10, className: 'particle-echo', lifetime: 2500 },
  ignite:      { count: 1,  className: 'particle-ignite', lifetime: 600 },
  smother:     { count: 16, className: 'particle-smother', lifetime: 1000 },
  howl:        { count: 20, className: 'particle-howl', lifetime: 2000 },
}

function spawnParticle(className, x, y, vars, lifetime) {
  const el = document.createElement('div')
  el.className = `particle ${className}`
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  for (const [k, v] of Object.entries(vars)) {
    el.style.setProperty(`--${k}`, v)
  }
  document.body.appendChild(el)
  setTimeout(() => el.remove(), lifetime)
}

export function createParticles(e, type) {
  const rect = e.currentTarget.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  if (type === 'create') {
    const count = isMobile ? 12 : 24
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count
      const dist = 150 + Math.random() * 100
      spawnParticle('particle-create', cx, cy, {
        startX: `${Math.cos(angle) * dist}px`,
        startY: `${Math.sin(angle) * dist}px`,
        delay: `${Math.random() * 200}ms`,
        size: `${4 + Math.random() * 6}px`,
      }, 1000)
    }
    return
  }

  const config = particleConfigs[type]
  if (!config) return

  const m = isMobile ? 0.5 : 1
  const count = type === 'ignite' ? 1 : Math.round(config.count * m)

  if (type === 'ignite') {
    spawnParticle('particle-ignite', cx, cy, {}, config.lifetime)
    return
  }

  for (let i = 0; i < count; i++) {
    let vars = {}
    let x = cx, y = cy

    if (type === 'sublimate') {
      const xDrift = (Math.random() - 0.5) * (isMobile ? 200 : 400)
      const yFloat = -200 - Math.random() * (isMobile ? 150 : 300)
      vars = {
        x: `${xDrift}px`, y: `${yFloat}px`,
        size: `${isMobile ? (40 + Math.random() * 60) : (80 + Math.random() * 120)}px`,
        delay: `${Math.random() * 400}ms`,
      }
      x = cx + (Math.random() - 0.5) * 150
    }

    if (type === 'crystallise') {
      const angle = (Math.PI * 0.2) + (Math.random() * Math.PI * 0.6)
      const vel = 80 + Math.random() * 120
      vars = {
        x: `${Math.cos(angle) * vel * (Math.random() > 0.5 ? 1 : -1)}px`,
        y: `${Math.sin(angle) * vel}px`,
        delay: `${Math.random() * 150}ms`,
        size: `${8 + Math.random() * 8}px`,
      }
      x = cx + (Math.random() - 0.5) * 60
    }

    if (type === 'grip') {
      vars = {
        x: `${(Math.random() - 0.5) * 80}px`,
        y: `${60 + Math.random() * 120}px`,
        delay: `${Math.random() * 200}ms`,
        size: `${4 + Math.random() * 6}px`,
      }
      x = cx + (Math.random() - 0.5) * 100
    }

    if (type === 'release') {
      vars = {
        x: `${(Math.random() - 0.5) * 250}px`,
        y: `${(Math.random() - 0.5) * 250}px`,
        midX: `${(Math.random() - 0.5) * 150}px`,
        midY: `${(Math.random() - 0.5) * 150}px`,
        delay: `${Math.random() * 600}ms`,
        size: `${15 + Math.random() * 30}px`,
      }
      x = cx + (Math.random() - 0.5) * 60
    }

    if (type === 'echo') {
      const angle = Math.random() * Math.PI * 2
      const dist = isMobile ? (100 + Math.random() * 100) : (200 + Math.random() * 200)
      vars = {
        startX: `${Math.cos(angle) * dist}px`,
        startY: `${Math.sin(angle) * dist}px`,
        delay: `${Math.random() * 800}ms`,
        size: `${isMobile ? (20 + Math.random() * 30) : (40 + Math.random() * 60)}px`,
      }
    }

    if (type === 'smother') {
      const angle = (Math.PI * 2 * i) / count
      const dist = 100 + Math.random() * 80
      vars = {
        startX: `${Math.cos(angle) * dist}px`,
        startY: `${Math.sin(angle) * dist}px`,
        delay: `${Math.random() * 150}ms`,
        size: `${5 + Math.random() * 5}px`,
      }
    }

    if (type === 'howl') {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3
      const dist = 120 + Math.random() * 150
      vars = {
        x: `${Math.cos(angle) * dist}px`,
        y: `${Math.sin(angle) * dist}px`,
        delay: `${Math.random() * 100}ms`,
        size: `${6 + Math.random() * 10}px`,
      }
    }

    spawnParticle(config.className, x, y, vars, config.lifetime)
  }
}
