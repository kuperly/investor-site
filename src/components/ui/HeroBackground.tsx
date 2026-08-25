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
        className="pointer-events-none absolute inset-0 -z-10 hidden h-full w-full sm:block"
        viewBox="0 0 1000 400"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g style={{ stroke: 'rgb(var(--color-primary))' }} fill="none" strokeWidth={1} opacity={0.4}>
          <rect x="540" y="160" width="65" height="240" />
          <path d="M625 400 V130 L672 90 L719 130 V400" />
          <rect x="745" y="220" width="50" height="180" />
          <rect x="815" y="95" width="95" height="305" />
          <rect x="930" y="250" width="55" height="150" />
        </g>
        <path
          d="M520 330 L640 270 L730 300 L830 160 L1000 90"
          style={{ stroke: 'rgb(var(--color-secondary))' }}
          strokeWidth={2.5}
          fill="none"
          opacity={0.85}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="1000" cy="90" r="4" style={{ fill: 'rgb(var(--color-secondary))' }} opacity={0.85} />
      </svg>
    </>
  )
}
