'use client'

import { useEffect, useRef } from 'react'

const GROUND = 520

/**
 * Decorative hero backdrop: a quiet skyline outline in fine brass linework
 * on a ground line. It draws itself in on load and drifts subtly on scroll. No charts, no photography; purely
 * decorative and hidden from assistive tech. Reduced motion collapses every
 * animation to its final frame.
 */
export function HeroBackground() {
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const node = layerRef.current
    if (!node) return

    let frame = 0
    function onScroll() {
      if (frame) return
      frame = requestAnimationFrame(() => {
        // A gentle drift — capped so the backdrop never detaches from the hero.
        const offset = Math.min(window.scrollY, 700) * 0.1
        node!.style.transform = `translate3d(0, ${offset}px, 0)`
        frame = 0
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div ref={layerRef} aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 will-change-transform">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(900px circle at 85% 20%, rgb(var(--color-primary) / 0.10), transparent 60%), ' +
            'linear-gradient(to bottom, transparent 70%, rgb(var(--color-background)) 100%)',
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full opacity-25 sm:opacity-100"
        viewBox="0 0 1000 600"
        preserveAspectRatio="xMaxYMax slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* module grid — structure, discipline */}
        <g style={{ stroke: 'rgb(var(--color-foreground))' }} opacity={0.045} strokeWidth={1}>
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d={`M${(i + 1) * 80} 0V600`} />
          ))}
        </g>

        {/* ground line */}
        <path
          className="draw-line"
          pathLength={1}
          d={`M380 ${GROUND}H1000`}
          style={{ stroke: 'rgb(var(--color-foreground))' }}
          strokeWidth={1}
          opacity={0.35}
        />

        <g style={{ stroke: 'rgb(var(--color-primary))' }} fill="none" strokeWidth={1}>
          {/* building outlines */}
          <g className="draw-line-group" opacity={0.4}>
            <path pathLength={1} d={`M520 ${GROUND}V340L565 305L610 340V${GROUND}`} />
            <rect pathLength={1} x="630" y="130" width="150" height={GROUND - 130} />
            <rect pathLength={1} x="800" y="230" width="170" height={GROUND - 230} />
          </g>

        </g>
      </svg>
    </div>
  )
}
