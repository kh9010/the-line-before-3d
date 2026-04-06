export const chars = 'abcdefghijklmnopqrstuvwxyz'
export const placeholderLength = 20

export let isMobile = window.matchMedia('(max-width: 768px)').matches
window.matchMedia('(max-width: 768px)').addEventListener('change', (e) => { isMobile = e.matches })

export function shuffle(array) {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function phraseToHue(text) {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash
  }
  return ((hash % 360) + 360) % 360
}
