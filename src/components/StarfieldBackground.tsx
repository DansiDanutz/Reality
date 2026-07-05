import { useEffect, useRef } from 'react'

/**
 * An animated starfield background — hundreds of twinkling stars across
 * three parallax layers, plus occasional satellites that drift slowly across
 * the sky with a tiny glowing trail.
 *
 * Pure canvas (CSS can't animate hundreds of points performantly). Sits at
 * z-index 0, fixed behind everything. Respects prefers-reduced-motion (static
 * stars, no satellites). Pauses when the tab is hidden (visibilitychange) to
 * save battery.
 *
 * The stars have a slow twinkle (sin-based opacity oscillation, each on its
 * own phase). The three layers parallax at different rates — an illusion of
 * depth without a real camera. Satellites appear every ~20-40s, cross over
 * ~12s, and leave a faint trail.
 */
export default function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let running = true
    let W = 0
    let H = 0

    // ── Star generation ──────────────────────────────────────
    // Three layers: far (dim, many, slow twinkle), mid, near (bright, few,
    // fast twinkle). Counts scale with viewport area so big screens get more.
    interface Star {
      x: number; y: number; r: number; layer: 0 | 1 | 2
      phase: number; twinkleSpeed: number; baseAlpha: number
    }
    let stars: Star[] = []

    const regen = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      canvas.style.width = `${W}px`
      canvas.style.height = `${H}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const area = W * H
      const farCount = Math.min(220, Math.floor(area / 6_000))
      const midCount = Math.min(90, Math.floor(area / 14_000))
      const nearCount = Math.min(35, Math.floor(area / 36_000))
      stars = []
      const make = (count: number, layer: 0 | 1 | 2) => {
        for (let i = 0; i < count; i++) {
          const r = layer === 0 ? 0.4 + Math.random() * 0.5 : layer === 1 ? 0.7 + Math.random() * 0.8 : 1.1 + Math.random() * 1.2
          stars.push({
            x: Math.random() * W,
            y: Math.random() * H,
            r,
            layer,
            phase: Math.random() * Math.PI * 2,
            twinkleSpeed: 0.3 + Math.random() * (layer === 2 ? 1.4 : 0.6),
            baseAlpha: layer === 0 ? 0.25 + Math.random() * 0.2 : layer === 1 ? 0.4 + Math.random() * 0.3 : 0.55 + Math.random() * 0.35,
          })
        }
      }
      make(farCount, 0)
      make(midCount, 1)
      make(nearCount, 2)
    }
    regen()
    window.addEventListener('resize', regen)

    // ── Satellites ───────────────────────────────────────────
    // A satellite crosses the sky every ~20-40s. It has a tiny bright dot and
    // a faint fading trail. Direction is roughly horizontal with a slight
    // downward angle (orbit-like). Skipped for reduced-motion.
    interface Sat { x: number; y: number; vx: number; vy: number; trail: { x: number; y: number; a: number }[] }
    let sat: Sat | null = null
    let nextSatAt = performance.now() + 8_000 + Math.random() * 12_000

    const spawnSat = (now: number) => {
      const fromLeft = Math.random() < 0.5
      const speed = 0.25 + Math.random() * 0.2 // px/ms — slow, distant
      const angle = (fromLeft ? 1 : -1) * (0.04 + Math.random() * 0.06) // slight downward
      sat = {
        x: fromLeft ? -20 : W + 20,
        y: H * (0.1 + Math.random() * 0.4), // upper portion of the sky
        vx: (fromLeft ? 1 : -1) * speed,
        vy: speed * angle * 4,
        trail: [],
      }
      nextSatAt = now + 18_000 + Math.random() * 22_000
    }

    // ── Render loop ──────────────────────────────────────────
    let last = performance.now()
    const render = () => {
      if (!running) return
      raf = requestAnimationFrame(render)
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now

      ctx.clearRect(0, 0, W, H)

      // Stars — twinkle via sin(phase), drift slowly upward (parallax by layer).
      for (const s of stars) {
        s.phase += s.twinkleSpeed * dt
        if (!reduced) {
          // Subtle upward drift; wrap around the top.
          s.y -= (0.15 + s.layer * 0.25) * dt
          if (s.y < -2) s.y = H + 2
        }
        const twinkle = reduced ? 1 : 0.65 + 0.35 * Math.sin(s.phase)
        const alpha = s.baseAlpha * twinkle
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        // Far stars are cool blue-white; near stars slightly warmer.
        const hue = s.layer === 2 ? 'rgba(220, 230, 255,' : 'rgba(190, 210, 245,'
        ctx.fillStyle = `${hue} ${alpha})`
        ctx.fill()
        // Near stars get a faint glow halo.
        if (s.layer === 2 && alpha > 0.5) {
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.r * 2.5, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(200, 220, 255, ${alpha * 0.12})`
          ctx.fill()
        }
      }

      // Satellite — drift, trail, despawn off-screen.
      if (!reduced) {
        if (!sat && now >= nextSatAt) spawnSat(now)
        if (sat) {
          // Fixed-step movement (~16ms/frame). vx/vy are in px/ms.
          const step = Math.min((now - last + dt * 1000), 32)
          sat.x += sat.vx * step
          sat.y += sat.vy * step
          // Record trail point.
          sat.trail.push({ x: sat.x, y: sat.y, a: 0.5 })
          if (sat.trail.length > 40) sat.trail.shift()
          // Fade trail.
          for (const t of sat.trail) t.a *= 0.96

          // Draw trail (oldest = faintest).
          for (let i = 0; i < sat.trail.length; i++) {
            const t = sat.trail[i]
            ctx.beginPath()
            ctx.arc(t.x, t.y, 0.8, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(200, 220, 255, ${t.a * 0.3})`
            ctx.fill()
          }
          // Draw satellite dot — tiny bright warm-white.
          ctx.beginPath()
          ctx.arc(sat.x, sat.y, 1.3, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(255, 245, 220, 0.9)'
          ctx.fill()

          // Despawn off-screen.
          if (sat.x < -60 || sat.x > W + 60 || sat.y > H + 60) sat = null
        }
      }
    }
    render()

    // Pause on tab hidden — saves battery on laptops/phones.
    const onVisibility = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      } else if (!running) {
        running = true
        last = performance.now()
        render()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', regen)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="starfield-bg"
      aria-hidden
    />
  )
}
