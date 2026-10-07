'use client'

import { useEffect, useRef, useState } from 'react'
import { model } from '@/lib/content'

const STAGES = model.cycle
const COUNT = STAGES.length
const STEP_MS = 3200
// Ring geometry, in a 400×400 viewBox.
const R = 140
const C = 200

/** Point on the ring, angle in degrees clockwise from 12 o'clock. */
function onRing(deg: number) {
  const rad = (deg * Math.PI) / 180
  return { x: C + R * Math.sin(rad), y: C - R * Math.cos(rad) }
}

// Node positions as % of the square, for the HTML buttons over the SVG.
const NODE_POS = STAGES.map((_, i) => {
  const { x, y } = onRing((360 / COUNT) * i)
  return { left: `${(x / 400) * 100}%`, top: `${(y / 400) * 100}%` }
})

/**
 * The ValeForge Model as a living loop rather than a list: capital enters at
 * "Find Opportunity", then cycles Acquire → Create Value → Monetize →
 * Recycle Capital → Acquire again. A brass arc travels the ring to the
 * active stage, whose line shows in the centre.
 *
 * Autoplays only while on screen, never under reduced motion, pauses on
 * hover/focus, stops once the visitor picks a stage, and has an explicit
 * pause control (WCAG 2.2.2).
 */
export function ModelFlywheel() {
  // A forever-increasing step counter (not an index) so the arc always
  // travels forward, including across the Recycle → Acquire wrap.
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [inView, setInView] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(true)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    const node = rootRef.current
    if (!node) return
    const observer = new IntersectionObserver((entries) => setInView(Boolean(entries[0]?.isIntersecting)), {
      threshold: 0.4,
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const autoplay = inView && !paused && !hovering && !reducedMotion

  useEffect(() => {
    if (!autoplay) return
    const id = window.setInterval(() => setStep((s) => s + 1), STEP_MS)
    return () => window.clearInterval(id)
  }, [autoplay])

  const active = step % COUNT
  const stage = STAGES[active]
  const isAgain = step >= COUNT && active === 0

  function select(index: number) {
    setPaused(true)
    setStep((s) => s + ((index - (s % COUNT) + COUNT) % COUNT))
  }

  // Arc covering the quarter that leads into the active stage.
  const seg = 100 / COUNT
  const arcOffset = -((step - 1) * seg)

  return (
    <div
      ref={rootRef}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setHovering(false)
      }}
    >
      {/* Screen readers get the full sequence plainly. */}
      <ol className="sr-only">
        {model.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>

      {/* Entry point: opportunity feeds the loop at the top. */}
      <div aria-hidden="true" className="flex flex-col items-center">
        <span className="text-xs font-semibold uppercase tracking-eyebrow text-primary">
          {model.steps[0]}
        </span>
        <span className="mt-3 h-6 w-px bg-gradient-to-b from-transparent to-primary/70" />
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[32rem]">
        <svg viewBox="0 0 400 400" aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible">
          {/* entry line from the label into the top node */}
          <path d={`M${C} 0V${C - R}`} className="stroke-primary/70" strokeWidth={1} />
          {/* the ring */}
          <circle cx={C} cy={C} r={R} fill="none" className="stroke-border" strokeWidth={1} />
          {/* inner hairline ring for depth */}
          <circle cx={C} cy={C} r={R - 46} fill="none" className="stroke-border" strokeWidth={1} opacity={0.5} strokeDasharray="2 6" />
          {/* travelling arc */}
          <circle
            cx={C}
            cy={C}
            r={R}
            fill="none"
            pathLength={100}
            transform={`rotate(-90 ${C} ${C})`}
            className="stroke-primary transition-[stroke-dashoffset,opacity] duration-1000 ease-[cubic-bezier(0.65,0,0.35,1)]"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={`${seg} ${100 - seg}`}
            strokeDashoffset={arcOffset}
            opacity={step === 0 ? 0 : 1}
          />
          {/* clockwise direction chevrons between stages */}
          {STAGES.map((_, i) => {
            const deg = (360 / COUNT) * (i + 0.5)
            const { x, y } = onRing(deg)
            return (
              <path
                key={i}
                d="M-4 -5 L3 0 L-4 5"
                transform={`translate(${x} ${y}) rotate(${deg})`}
                fill="none"
                className="stroke-primary/60"
                strokeWidth={1.25}
              />
            )
          })}
        </svg>

        {/* stage nodes */}
        {STAGES.map((s, i) => {
          const isActive = i === active
          return (
            <button
              key={s.title}
              type="button"
              aria-pressed={isActive}
              onClick={() => select(i)}
              style={NODE_POS[i]}
              className="group absolute flex min-h-[44px] min-w-[44px] -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            >
              <span
                className={`max-w-[6.5rem] rounded-sm border px-2.5 py-1.5 text-center text-[0.8rem] font-semibold uppercase leading-tight tracking-[0.12em] transition-colors duration-500 sm:max-w-none sm:whitespace-nowrap sm:px-3 sm:text-xs ${
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground group-hover:border-primary/60 group-hover:text-foreground'
                }`}
              >
                {s.title}
              </span>
            </button>
          )
        })}

        {/* centre readout */}
        <div className="pointer-events-none absolute inset-[24%] flex flex-col items-center justify-center text-center">
          <span aria-hidden="true" className="text-xs tabular-nums tracking-eyebrow text-muted-foreground">
            {String(active + 1).padStart(2, '0')} / {String(COUNT).padStart(2, '0')}
          </span>
          <p key={step} className="flywheel-swap mt-2 font-heading text-2xl leading-tight text-foreground sm:text-3xl">
            {isAgain ? 'Acquire Again' : stage.title}
          </p>
          <p key={`l${step}`} className="flywheel-swap mt-2 text-pretty text-sm leading-snug text-muted-foreground sm:text-base">
            {stage.line}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">
          <span aria-hidden="true" className="mr-2 text-primary">
            ↻
          </span>
          The loop repeats — depending on the opportunity.
        </p>
        {!reducedMotion && (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex min-h-[44px] items-center text-sm font-medium text-primary transition-colors hover:text-secondary"
          >
            {paused ? 'Play' : 'Pause'}
            <span className="sr-only"> the model animation</span>
          </button>
        )}
      </div>
    </div>
  )
}
