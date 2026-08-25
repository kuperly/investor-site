'use client'

import { useEffect, useRef } from 'react'

/**
 * Decorative, typography-led hero backdrop: a warm brass wash, a faint
 * baseline grid, a restrained skyline, and an appreciation trendline that
 * draws itself in — the visual thesis of the firm (value compounding
 * upward over time). Subtle scroll parallax adds depth. Purely decorative
 * and hidden from assistive tech; all motion respects reduced-motion.
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
        const offset = Math.min(window.scrollY, 600) * 0.12
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
            'radial-gradient(720px circle at 12% 8%, rgb(var(--color-primary) / 0.12), transparent 60%), ' +
            'radial-gradient(560px circle at 88% 30%, rgb(var(--color-secondary) / 0.09), transparent 55%)',
        }}
      />
      <svg
        className="absolute inset-0 hidden h-full w-full sm:block"
        viewBox="0 0 1000 400"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* faint baseline grid — structure, discipline */}
        <g style={{ stroke: 'rgb(var(--color-foreground))' }} opacity={0.05} strokeWidth={1}>
          <path d="M0 100 H1000 M0 200 H1000 M0 300 H1000" />
          <path d="M200 0 V400 M400 0 V400 M600 0 V400 M800 0 V400" />
        </g>

        {/* horizon */}
        <path d="M0 344 H1000" style={{ stroke: 'rgb(var(--color-border))' }} strokeWidth={1} opacity={0.9} />

        {/* skyline — grounded on the horizon */}
        <g style={{ stroke: 'rgb(var(--color-primary))' }} fill="none" strokeWidth={1} opacity={0.35}>
          <rect x="540" y="184" width="65" height="160" />
          <path d="M625 344 V150 L672 116 L719 150 V344" />
          <rect x="745" y="228" width="50" height="116" />
          <rect x="815" y="128" width="95" height="216" />
          <rect x="930" y="250" width="55" height="94" />
        </g>

        {/* appreciation trendline — the thesis, drawn in on load */}
        <path
          className="hero-trendline"
          d="M520 322 L640 276 L730 296 L830 190 L985 104"
          style={{ stroke: 'rgb(var(--color-secondary))' }}
          strokeWidth={2.5}
          fill="none"
          opacity={0.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle className="hero-endpoint" cx="985" cy="104" r="4" style={{ fill: 'rgb(var(--color-secondary))' }} />
      </svg>
    </div>
  )
}
