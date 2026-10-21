import Link from 'next/link'
import type { ReactNode } from 'react'

const base =
  'group inline-flex min-h-[48px] items-center justify-center gap-3 rounded-sm px-7 py-3 text-[0.95rem] font-medium tracking-wide transition-colors duration-300'

/**
 * The two call-to-action styles used site-wide. Exported as class strings so
 * a native <button> (the contact form submit) can match the links exactly.
 */
export const buttonClasses = {
  primary: `${base} bg-primary text-primary-foreground hover:bg-secondary`,
  secondary: `${base} border border-foreground/25 text-foreground hover:border-primary hover:text-primary`,
}

export function Arrow() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="transition-transform duration-300 group-hover:translate-x-1"
    >
      <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  )
}

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  className = '',
}: {
  href: string
  children: ReactNode
  variant?: keyof typeof buttonClasses
  className?: string
}) {
  return (
    <Link href={href} className={`${buttonClasses[variant]} ${className}`}>
      {children}
      <Arrow />
    </Link>
  )
}

/** Quiet inline text link with the same sliding arrow. */
export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex min-h-[44px] items-center gap-2 font-medium text-primary transition-colors duration-200 hover:text-secondary"
    >
      {children}
      <Arrow />
    </Link>
  )
}
