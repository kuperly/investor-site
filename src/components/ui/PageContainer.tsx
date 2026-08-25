import type { ReactNode } from 'react'

/**
 * The single page-width container. Every page and the header/footer use this,
 * so all content shares one max-width and gutter and lines up vertically
 * across the whole site.
 */
export function PageContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>
}
