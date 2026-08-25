'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { siteConfig } from '@/lib/site-config'

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 8)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
        isScrolled ? 'border-border bg-background/80 backdrop-blur-md' : 'border-transparent bg-background'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="font-heading text-xl font-semibold text-foreground">
          {siteConfig.name}
        </Link>

        <nav aria-label="Primary" className="hidden gap-8 sm:flex">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-foreground transition-colors duration-200 hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-nav"
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setIsMenuOpen((open) => !open)}
          className="min-h-[44px] min-w-[44px] text-foreground sm:hidden"
        >
          {isMenuOpen ? 'Close' : 'Menu'}
        </button>
      </div>

      {isMenuOpen && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-border px-4 pb-4 sm:hidden">
          <ul className="flex flex-col gap-4 pt-4">
            {siteConfig.nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block min-h-[44px] py-2 text-foreground"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  )
}
