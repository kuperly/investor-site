import type { ReactNode } from 'react'

/**
 * The single full-bleed page container: content spans the full viewport with a
 * consistent responsive gutter. Every page and the header/footer use the same
 * gutter (see `pageGutter`), so all content shares one left/right edge and
 * lines up across the whole site. Constrain individual text blocks with
 * `max-w-*` for readable line length — the container itself is edge-to-edge.
 */
export const pageGutter = 'px-5 sm:px-8 lg:px-12'

export function PageContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`w-full ${pageGutter} ${className}`}>{children}</div>
}
