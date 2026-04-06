import { useState, useEffect, useRef } from 'react'
import { chars, placeholderLength } from './helpers'

const groundedChoices = new Set(['crystallise', 'grip', 'echo', 'smother'])

export function IdleScramble() {
  const [displayText, setDisplayText] = useState('')
  const intervalRef = useRef(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setDisplayText(
        Array(placeholderLength)
          .fill('')
          .map(() => chars[Math.floor(Math.random() * chars.length)])
          .join('')
      )
    }, 150)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return <span className="idle-scramble">{displayText}</span>
}

export function SettlingText({ text, mode }) {
  const [displayText, setDisplayText] = useState('')
  const [settled, setSettled] = useState(false)
  const intervalRef = useRef(null)
  const isGrounded = groundedChoices.has(mode)

  useEffect(() => {
    if (!isGrounded) {
      setDisplayText(text)
      setSettled(true)
      return
    }

    let iteration = 0
    const speed = 30
    const iterations = 10

    intervalRef.current = setInterval(() => {
      setDisplayText(
        text
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' '
            if (index < iteration) return text[index]
            return chars[Math.floor(Math.random() * chars.length)]
          })
          .join('')
      )

      iteration += text.length / iterations

      if (iteration >= text.length) {
        clearInterval(intervalRef.current)
        setDisplayText(text)
        setSettled(true)
      }
    }, speed)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [text, mode, isGrounded])

  const animClass = isGrounded ? 'settle-grounded' : 'settle-flash'

  return (
    <span className={`settling-text ${animClass} ${settled ? 'settled' : ''}`}>
      {displayText}
    </span>
  )
}
