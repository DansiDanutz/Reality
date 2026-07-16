import { useEffect, useRef } from 'react'
import { mountScrollWorld } from './scrub-engine'
import { scrollWorldConfig } from './scrollworld.config'
import './scrollworld.css'

interface ScrollWorldIntroProps {
  /** Called when the visitor hits the final CTA (or skips) — hands off to Welcome. */
  onEnter: () => void
}

/**
 * Scroll-scrubbed cinematic intro (scroll-world engine, MIT — oso95/scroll-world).
 * Mounted only while no citizen exists and SCROLL_WORLD_ENABLED is true.
 * The engine is framework-agnostic vanilla JS: it owns its DOM inside the
 * container and is torn down on unmount.
 */
export default function ScrollWorldIntro({ onEnter }: ScrollWorldIntroProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onEnterRef = useRef(onEnter)
  onEnterRef.current = onEnter

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const sections = scrollWorldConfig.sections.map((section) =>
      section.cta
        ? { ...section, cta: { ...section.cta, onClick: () => onEnterRef.current() } }
        : section,
    )
    const handle = mountScrollWorld(container, { ...scrollWorldConfig, sections })
    return () => {
      handle?.destroy?.()
      container.replaceChildren()
    }
  }, [])

  return (
    <div className="scrollworld-intro" role="region" aria-label="Reality cinematic intro">
      <div ref={containerRef} className="scrollworld-mount" />
      <button
        type="button"
        className="scrollworld-skip"
        onClick={() => onEnterRef.current()}
      >
        Skip intro
      </button>
    </div>
  )
}
