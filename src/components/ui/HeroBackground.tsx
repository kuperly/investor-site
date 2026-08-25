export function HeroBackground() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(650px circle at 15% 10%, rgb(var(--color-primary) / 0.14), transparent 60%), ' +
            'radial-gradient(500px circle at 85% 40%, rgb(var(--color-secondary) / 0.10), transparent 55%)',
        }}
      />
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
        viewBox="0 0 1000 400"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g style={{ stroke: 'rgb(var(--color-primary))' }} fill="none" strokeWidth={1}>
          <path d="M480 40 C 620 10, 780 60, 980 20" opacity={0.15} />
          <path d="M460 90 C 610 55, 790 115, 990 70" opacity={0.22} />
          <path d="M440 145 C 600 105, 800 170, 1000 125" opacity={0.3} />
          <path d="M430 200 C 600 160, 810 225, 1000 180" opacity={0.38} />
          <path d="M430 255 C 610 215, 820 275, 1000 235" opacity={0.3} />
          <path d="M450 305 C 620 270, 810 325, 1000 290" opacity={0.22} />
          <path d="M480 355 C 630 325, 800 370, 1000 340" opacity={0.15} />
        </g>
      </svg>
    </>
  )
}
