'use client'

import { useEffect, useRef } from 'react'

const GROUND = 520

/** Floor lines + mullions for one building elevation. */
function facade(x: number, y: number, w: number, floor: number, bays: number) {
  const lines: string[] = []
  for (let fy = y + floor; fy < GROUND; fy += floor) lines.push(`M${x} ${fy}H${x + w}`)
  for (let i = 1; i < bays; i++) {
    const bx = x + (w / bays) * i
    lines.push(`M${bx} ${y}V${GROUND}`)
  }
  return lines.join('')
}

/**
 * Decorative hero backdrop: an architectural elevation drawn in fine brass
 * linework — a small mid-rise district on a ground line, with a dimension
 * line above it, like a page from a set of drawings. It draws itself in on
 * load and drifts subtly on scroll. No charts, no photography; purely
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
          <g className="draw-line-group" opacity={0.55}>
            <path pathLength={1} d={`M520 ${GROUND}V340L565 305L610 340V${GROUND}`} />
            <rect pathLength={1} x="630" y="130" width="150" height={GROUND - 130} />
            <rect pathLength={1} x="800" y="230" width="170" height={GROUND - 230} />
            <path pathLength={1} d={`M780 190H800`} />
          </g>

          {/* facade detail — fades in after the outlines */}
          <g className="draw-fade" opacity={0.2}>
            <path d={facade(520, 340, 90, 45, 2)} />
            <path d={facade(630, 130, 150, 36, 5)} />
            <path d={facade(800, 230, 170, 29, 6)} />
          </g>

          {/* dimension line above the tower */}
          <g className="draw-fade" opacity={0.45}>
            <path d="M630 100H780M630 92V108M780 92V108" />
            <path d="M600 130V520M592 130H608M592 520H608" />
          </g>
        </g>
      </svg>
    </div>
  )
}
