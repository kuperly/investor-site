'use client'

import { useEffect, useState } from 'react'

/**
 * Light/dark switch. Sets an explicit `data-theme` on <html> (overriding the
 * OS `prefers-color-scheme`) and persists the choice. A blocking script in the
 * root layout applies the saved value before first paint, so there's no flash.
 */
export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    setMounted(true)
    let stored: string | null = null
    try {
      stored = localStorage.getItem('theme')
    } catch {
      stored = null
    }
    setIsDark(
      stored === 'light'
        ? false
        : stored === 'dark'
          ? true
          : window.matchMedia('(prefers-color-scheme: dark)').matches,
    )
  }, [])

  function toggle() {
    const next = !isDark
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      /* storage unavailable — the choice just won't persist */
    }
    setIsDark(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-foreground transition-colors duration-200 hover:text-primary"
    >
      {mounted ? (
        isDark ? (
          // Sun — offers a switch to light
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.75" />
            <path
              d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          // Moon — offers a switch to dark
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
          </svg>
        )
      ) : (
        <span className="h-5 w-5" />
      )}
    </button>
  )
}
