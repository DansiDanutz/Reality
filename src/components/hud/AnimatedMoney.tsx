import { useEffect, useRef, useState } from 'react'
import { formatMoney } from '../../game/engine'

interface AnimatedMoneyProps {
  value: number
}

/** Balance that counts to its new value — money you can feel moving */
export default function AnimatedMoney({ value }: AnimatedMoneyProps) {
  const [shown, setShown] = useState(value)
  const shownRef = useRef(value)
  const rafRef = useRef(0)

  useEffect(() => {
    const from = shownRef.current
    const delta = value - from
    if (delta === 0) return
    // Small drifts snap; real gains count up over ~600ms
    if (Math.abs(delta) < 2) {
      shownRef.current = value
      setShown(value)
      return
    }
    const start = performance.now()
    const DURATION = 600
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = from + delta * eased
      shownRef.current = next
      setShown(next)
      if (t < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value])

  return <>{formatMoney(Math.round(shown))}</>
}
