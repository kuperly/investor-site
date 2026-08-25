'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { siteConfig } from '@/lib/site-config'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Logo } from '@/components/ui/Logo'
import { pageGutter } from '@/components/ui/PageContainer'

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const pathname = usePathname()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname?.startsWith(href)
  }

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 8)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!isMenuOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  function closeMenu() {
    setIsMenuOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
        isScrolled ? 'border-border bg-background/80 backdrop-blur-md' : 'border-transparent bg-background'
      }`}
    >
      <div className={`flex items-center justify-between py-4 ${pageGutter}`}>
        <Link href="/" className="transition-opacity duration-200 hover:opacity-80">
          <Logo className="text-xl" />
        </Link>

        <div className="flex items-center gap-1 sm:gap-6">
          <nav aria-label="Primary" className="hidden gap-8 sm:flex">
            {siteConfig.nav.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative py-1 text-sm transition-colors duration-200 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-200 hover:text-primary hover:after:scale-x-100 ${
                    active ? 'font-medium text-primary after:scale-x-100' : 'text-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <ThemeToggle />

          <button
            ref={triggerRef}
            type="button"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-nav"
            aria-label="Open menu"
            onClick={() => setIsMenuOpen(true)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-foreground sm:hidden"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Off-canvas overlay. The fixed, overflow-hidden wrapper clips the
          parked drawer so it can't create horizontal scroll on mobile. */}
      <div
        className={`fixed inset-0 z-40 overflow-hidden sm:hidden ${
          isMenuOpen ? '' : 'pointer-events-none'
        }`}
      >
        <div
          aria-hidden={!isMenuOpen}
          data-testid="mobile-nav-scrim"
          onClick={closeMenu}
          className={`absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity duration-300 ${
            isMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          }`}
        />

        <div
          id="mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          className={`absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col border-l border-border bg-background transition-transform duration-300 ${
            isMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between px-4 py-4">
          <span className="font-heading text-lg font-semibold text-foreground">Menu</span>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close menu"
            onClick={closeMenu}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-foreground"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav aria-label="Mobile" className="flex flex-col gap-1 px-4 pt-2">
          {siteConfig.nav.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[44px] items-center gap-3 rounded-md px-2 py-3 transition-colors duration-200 hover:bg-card hover:text-primary ${
                  active ? 'font-medium text-primary' : 'text-foreground'
                }`}
                onClick={closeMenu}
              >
                <span
                  aria-hidden="true"
                  className={`h-4 w-px transition-colors ${active ? 'bg-primary' : 'bg-transparent'}`}
                />
                {item.label}
              </Link>
            )
          })}
        </nav>
        </div>
      </div>
    </header>
  )
}
