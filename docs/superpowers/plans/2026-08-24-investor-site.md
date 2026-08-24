# Investor/Real-Estate Credibility Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a 4-page Next.js marketing site (Home, Approach, About, Contact) that establishes credibility for a pre-launch real estate investment company, per the approved design spec.

**Architecture:** Next.js App Router + TypeScript + Tailwind CSS, statically-rendered pages with a single client component (the contact form) and one API route (contact submission via Resend). All brand-dependent copy (placeholder company name, nav, market focus, contact email) lives in one config module so it can be swapped in one place later.

**Tech Stack:** Next.js 15.1.0, React 19, TypeScript 5.7, Tailwind CSS 3.4, Zod 3.23, Resend 4.0 (email), Vitest 2.1 + React Testing Library 16 + jest-axe 9 (testing), deployed to Vercel.

**Spec:** [docs/superpowers/specs/2026-08-24-investor-site-design.md](../specs/2026-08-24-investor-site-design.md)

## Global Constraints

- Placeholder company name is **"Larkspur Capital Partners"** — defined once in `src/lib/site-config.ts`, never hardcoded elsewhere.
- No fabricated track record, AUM, deal count, or team-size claims anywhere in copy.
- No stock real-estate photography (house listings, generic handshake photos) — typography-led / abstract visual treatment only.
- Colors: dark institutional navy/gold theme by default, with a light-mode variant via `prefers-color-scheme`, both meeting 4.5:1 text contrast (see Task 2 for exact values).
- Typography: EB Garamond (heading) + Lato (body), loaded via `next/font/google`.
- Touch targets ≥44×44px; visible focus states; `prefers-reduced-motion` respected; semantic HTML with correct heading hierarchy; SVG-only icons (no emoji).
- No CMS — content lives in code for this phase. No investor portal, deal portfolio, team page beyond the founder, or blog.

---

### Task 1: Project scaffold + testing infrastructure

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.js`
- Create: `tailwind.config.ts`
- Create: `.gitignore`
- Create: `.eslintrc.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Test: `src/lib/smoke.test.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: a buildable Next.js app at `src/app/`, a working `npm test` (Vitest) harness, path alias `@/*` → `./src/*`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "investor-site",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "15.1.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "resend": "4.0.1",
    "zod": "3.23.8"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "6.6.3",
    "@testing-library/react": "16.0.1",
    "@testing-library/user-event": "14.5.2",
    "@types/node": "22.10.2",
    "@types/react": "19.0.2",
    "@types/react-dom": "19.0.2",
    "@vitejs/plugin-react": "4.3.4",
    "autoprefixer": "10.4.20",
    "eslint": "9.17.0",
    "eslint-config-next": "15.1.0",
    "jest-axe": "9.0.0",
    "jsdom": "25.0.1",
    "postcss": "8.4.49",
    "tailwindcss": "3.4.17",
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  }
}
```

- [ ] **Step 2: Create TypeScript, Next, Tailwind, PostCSS, ESLint configs**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "**/*.test.ts", "**/*.test.tsx"]
}
```

`next.config.ts`:
```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default nextConfig
```

`postcss.config.js`:
```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

`tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config
```

`.eslintrc.json`:
```json
{
  "extends": "next/core-web-vitals"
}
```

`.gitignore`:
```
node_modules
.next
.env
.env*.local
!.env.example
```

- [ ] **Step 3: Create the app skeleton**

`src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Investor Site',
  description: 'Placeholder',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

`src/app/page.tsx`:
```tsx
export default function HomePage() {
  return <main>Home</main>
}
```

- [ ] **Step 4: Create the Vitest harness**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

`vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

`src/lib/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`

- [ ] **Step 6: Verify the app builds**

Run: `npm run build`
Expected: build completes with no errors (route `/` compiled).

- [ ] **Step 7: Verify the test harness runs**

Run: `npm test`
Expected: PASS — 1 test file, 1 test.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js app with Tailwind and Vitest"
```

---

### Task 2: Design tokens (colors, fonts)

**Files:**
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`
- Test: `tailwind.config.test.ts`

**Interfaces:**
- Consumes: `tailwind.config.ts` from Task 1
- Produces: Tailwind color utilities (`background`, `foreground`, `primary`/`primary-foreground`, `secondary`, `card`, `muted`/`muted-foreground`, `border`, `destructive`/`destructive-foreground`) and font families (`font-heading`, `font-body`) usable by every later component/page task

- [ ] **Step 1: Add CSS custom properties for dark (default) and light themes**

Replace the contents of `src/app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-background: 15 23 42; /* #0F172A */
  --color-foreground: 248 250 252; /* #F8FAFC */
  --color-primary: 245 158 11; /* #F59E0B */
  --color-primary-foreground: 15 23 42; /* #0F172A */
  --color-secondary: 251 191 36; /* #FBBF24 */
  --color-card: 34 39 53; /* #222735 */
  --color-muted: 39 47 66; /* #272F42 */
  --color-muted-foreground: 148 163 184; /* #94A3B8 */
  --color-border: 51 65 85; /* #334155 */
  --color-destructive: 239 68 68; /* #EF4444 */
  --color-destructive-foreground: 255 255 255;
}

@media (prefers-color-scheme: light) {
  :root {
    --color-background: 248 250 252; /* #F8FAFC */
    --color-foreground: 15 23 42; /* #0F172A */
    --color-primary: 146 64 14; /* #92400E - darkened for 4.5:1 on white */
    --color-primary-foreground: 255 255 255;
    --color-secondary: 180 83 9; /* #B45309 */
    --color-card: 255 255 255;
    --color-muted: 241 245 249;
    --color-muted-foreground: 71 85 105;
    --color-border: 226 232 240;
    --color-destructive: 220 38 38;
    --color-destructive-foreground: 255 255 255;
  }
}
```

- [ ] **Step 2: Wire the tokens into Tailwind**

Replace `tailwind.config.ts` with:

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--color-background) / <alpha-value>)',
        foreground: 'rgb(var(--color-foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          foreground: 'rgb(var(--color-primary-foreground) / <alpha-value>)',
        },
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        card: 'rgb(var(--color-card) / <alpha-value>)',
        muted: {
          DEFAULT: 'rgb(var(--color-muted) / <alpha-value>)',
          foreground: 'rgb(var(--color-muted-foreground) / <alpha-value>)',
        },
        border: 'rgb(var(--color-border) / <alpha-value>)',
        destructive: {
          DEFAULT: 'rgb(var(--color-destructive) / <alpha-value>)',
          foreground: 'rgb(var(--color-destructive-foreground) / <alpha-value>)',
        },
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 3: Write a token-shape test**

`tailwind.config.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import tailwindConfig from './tailwind.config'

describe('design tokens', () => {
  it('defines the expected color roles', () => {
    const colors = (tailwindConfig.theme?.extend as { colors: Record<string, unknown> }).colors
    expect(Object.keys(colors)).toEqual(
      expect.arrayContaining([
        'background',
        'foreground',
        'primary',
        'secondary',
        'card',
        'muted',
        'border',
        'destructive',
      ]),
    )
  })

  it('defines heading and body font families', () => {
    const fontFamily = (tailwindConfig.theme?.extend as { fontFamily: Record<string, unknown> })
      .fontFamily
    expect(fontFamily.heading).toBeDefined()
    expect(fontFamily.body).toBeDefined()
  })
})
```

- [ ] **Step 4: Run the test**

Run: `npm test`
Expected: PASS (2 new tests, 3 total).

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css tailwind.config.ts tailwind.config.test.ts
git commit -m "Add navy/gold design tokens with light-mode variant"
```

---

### Task 3: Site config (single source of truth)

**Files:**
- Create: `src/lib/site-config.ts`
- Test: `src/lib/site-config.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `siteConfig: { name: string; tagline: string; description: string; marketFocus: string; contactEmail: string; nav: { label: string; href: string }[] }` — imported by Header, Footer, all four pages, and the contact API route

- [ ] **Step 1: Write the failing test**

`src/lib/site-config.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { siteConfig } from './site-config'

describe('siteConfig', () => {
  it('has a non-empty placeholder name and tagline', () => {
    expect(siteConfig.name.length).toBeGreaterThan(0)
    expect(siteConfig.tagline.length).toBeGreaterThan(0)
  })

  it('exposes exactly the four primary nav items with unique hrefs', () => {
    expect(siteConfig.nav).toHaveLength(4)
    const hrefs = siteConfig.nav.map((item) => item.href)
    expect(new Set(hrefs).size).toBe(4)
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/approach', '/about', '/contact']))
  })

  it('has a plausible contact email', () => {
    expect(siteConfig.contactEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- site-config`
Expected: FAIL — `site-config.ts` does not exist.

- [ ] **Step 3: Write the implementation**

`src/lib/site-config.ts`:
```ts
/**
 * Single source of truth for site-wide, brand-dependent content.
 * `name` is a placeholder — swap it here when the real company name
 * is finalized. Nothing else in the codebase should hardcode it.
 */
export const siteConfig = {
  name: 'Larkspur Capital Partners',
  tagline: 'Disciplined real estate investment.',
  description:
    'Larkspur Capital Partners acquires and manages real estate for long-term capital appreciation, with a select number of disciplined renovation projects.',
  marketFocus: 'Texas and select U.S. markets',
  contactEmail: 'hello@example.com',
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Approach', href: '/approach' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ],
} as const

export type NavItem = (typeof siteConfig.nav)[number]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- site-config`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/site-config.ts src/lib/site-config.test.ts
git commit -m "Add single-source-of-truth site config"
```

---

### Task 4: Contact form schema

**Files:**
- Create: `src/lib/contact-schema.ts`
- Test: `src/lib/contact-schema.test.ts`

**Interfaces:**
- Consumes: `zod` (installed in Task 1)
- Produces: `contactFormSchema: ZodObject`, `type ContactFormValues = { intent: 'investor' | 'deal'; name: string; email: string; message: string }` — consumed by `ContactForm` (Task 11) and the `/api/contact` route (Task 12)

- [ ] **Step 1: Write the failing tests**

`src/lib/contact-schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { contactFormSchema } from './contact-schema'

const validPayload = {
  intent: 'investor' as const,
  name: 'Jamie Rivera',
  email: 'jamie@example.com',
  message: 'I would like to learn more about your fund.',
}

describe('contactFormSchema', () => {
  it('accepts a valid payload', () => {
    const result = contactFormSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('rejects an invalid intent', () => {
    const result = contactFormSchema.safeParse({ ...validPayload, intent: 'other' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing name', () => {
    const result = contactFormSchema.safeParse({ ...validPayload, name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid email', () => {
    const result = contactFormSchema.safeParse({ ...validPayload, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects a too-short message', () => {
    const result = contactFormSchema.safeParse({ ...validPayload, message: 'hi' })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- contact-schema`
Expected: FAIL — `contact-schema.ts` does not exist.

- [ ] **Step 3: Write the implementation**

`src/lib/contact-schema.ts`:
```ts
import { z } from 'zod'

export const contactIntents = ['investor', 'deal'] as const
export type ContactIntent = (typeof contactIntents)[number]

export const contactFormSchema = z.object({
  intent: z.enum(contactIntents, {
    errorMap: () => ({ message: 'Select whether you are an investor or have a deal to share.' }),
  }),
  name: z.string().trim().min(2, 'Enter your full name.').max(120),
  email: z.string().trim().email('Enter a valid email address.'),
  message: z.string().trim().min(10, 'Message must be at least 10 characters.').max(2000),
})

export type ContactFormValues = z.infer<typeof contactFormSchema>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- contact-schema`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/contact-schema.ts src/lib/contact-schema.test.ts
git commit -m "Add shared contact form validation schema"
```

---

### Task 5: Header component

**Files:**
- Create: `src/components/layout/Header.tsx`
- Test: `src/components/layout/Header.test.tsx`

**Interfaces:**
- Consumes: `siteConfig` from `src/lib/site-config.ts` (Task 3)
- Produces: `Header` component (default export style: named export `Header`) — consumed by root layout (Task 7)

- [ ] **Step 1: Write the failing test**

`src/components/layout/Header.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Header } from './Header'
import { siteConfig } from '@/lib/site-config'

describe('Header', () => {
  it('renders the brand name and all nav links', () => {
    render(<Header />)
    expect(screen.getAllByText(siteConfig.name).length).toBeGreaterThan(0)
    for (const item of siteConfig.nav) {
      expect(screen.getAllByRole('link', { name: item.label }).length).toBeGreaterThan(0)
    }
  })

  it('toggles the mobile menu open and closed', () => {
    const { container } = render(<Header />)
    const toggle = screen.getByRole('button', { name: /open menu/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(container.querySelector('#mobile-nav')).toBeNull()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(container.querySelector('#mobile-nav')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Header`
Expected: FAIL — `Header.tsx` does not exist.

- [ ] **Step 3: Write the implementation**

`src/components/layout/Header.tsx`:
```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { siteConfig } from '@/lib/site-config'

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="border-b border-border bg-background">
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Header`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Header.tsx src/components/layout/Header.test.tsx
git commit -m "Add site Header with mobile menu"
```

---

### Task 6: Footer component

**Files:**
- Create: `src/components/layout/Footer.tsx`
- Test: `src/components/layout/Footer.test.tsx`

**Interfaces:**
- Consumes: `siteConfig` from `src/lib/site-config.ts` (Task 3)
- Produces: `Footer` component — consumed by root layout (Task 7)

- [ ] **Step 1: Write the failing test**

`src/components/layout/Footer.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Footer } from './Footer'
import { siteConfig } from '@/lib/site-config'

describe('Footer', () => {
  it('renders brand name, market focus, and a mailto contact link', () => {
    render(<Footer />)
    expect(screen.getByText(siteConfig.name)).toBeInTheDocument()
    expect(screen.getByText(siteConfig.marketFocus)).toBeInTheDocument()
    const contactLink = screen.getByRole('link', { name: siteConfig.contactEmail })
    expect(contactLink).toHaveAttribute('href', `mailto:${siteConfig.contactEmail}`)
  })

  it('renders all nav links', () => {
    render(<Footer />)
    for (const item of siteConfig.nav) {
      expect(screen.getByRole('link', { name: item.label })).toBeInTheDocument()
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Footer`
Expected: FAIL — `Footer.tsx` does not exist.

- [ ] **Step 3: Write the implementation**

`src/components/layout/Footer.tsx`:
```tsx
import Link from 'next/link'
import { siteConfig } from '@/lib/site-config'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-heading text-lg text-foreground">{siteConfig.name}</p>
            <p className="mt-1 text-muted-foreground">{siteConfig.marketFocus}</p>
          </div>

          <nav aria-label="Footer" className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            {siteConfig.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-muted-foreground transition-colors duration-200 hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <a
            href={`mailto:${siteConfig.contactEmail}`}
            className="text-muted-foreground transition-colors duration-200 hover:text-primary"
          >
            {siteConfig.contactEmail}
          </a>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          © {year} {siteConfig.name}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Footer`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Footer.tsx src/components/layout/Footer.test.tsx
git commit -m "Add site Footer"
```

---

### Task 7: Root layout (fonts, header/footer, metadata, skip link)

**Files:**
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `Header` (Task 5), `Footer` (Task 6), `siteConfig` (Task 3)
- Produces: the shared page shell every route renders inside; establishes `--font-heading` / `--font-body` CSS variables used by Tailwind's `font-heading` / `font-body` utilities (Task 2)

- [ ] **Step 1: Replace the root layout**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { EB_Garamond, Lato } from 'next/font/google'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { siteConfig } from '@/lib/site-config'
import './globals.css'

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-heading',
  display: 'swap',
})

const lato = Lato({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ebGaramond.variable} ${lato.variable}`}>
      <body className="min-h-dvh bg-background font-body text-foreground antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        <Header />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds; `/` route renders the Header/Footer around the placeholder "Home" text from Task 1.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "Wire fonts, Header, and Footer into root layout"
```

---

### Task 8: Home page

**Files:**
- Modify: `src/app/page.tsx`
- Test: `src/app/page.test.tsx`

**Interfaces:**
- Consumes: `siteConfig` (Task 3)
- Produces: `HomePage` default export — reused directly by the a11y sweep in Task 14

- [ ] **Step 1: Write the failing test**

`src/app/page.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomePage from './page'
import { siteConfig } from '@/lib/site-config'

describe('HomePage', () => {
  it('renders the tagline as the h1 and both primary CTAs', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(siteConfig.tagline)
    expect(screen.getByRole('link', { name: 'See our approach' })).toHaveAttribute('href', '/approach')
    expect(screen.getByRole('link', { name: 'Get in touch' })).toHaveAttribute('href', '/contact')
  })

  it('renders three pillar headings', () => {
    render(<HomePage />)
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/page.test`
Expected: FAIL — current `page.tsx` renders plain "Home" text, no h1/links.

- [ ] **Step 3: Write the implementation**

`src/app/page.tsx`:
```tsx
import Link from 'next/link'
import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Home',
}

const pillars = [
  {
    title: 'Buy-and-hold appreciation',
    body: 'We acquire real estate built to compound in value over years, not quarters — underwritten for durable cash flow and long-term equity growth.',
  },
  {
    title: 'Disciplined flips',
    body: 'A smaller, selective book of renovation projects where the numbers work without relying on market timing.',
  },
  {
    title: `Focused on ${siteConfig.marketFocus}`,
    body: 'We go where the fundamentals are strongest, starting close to home and expanding only where discipline allows.',
  },
]

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <p className="font-body text-sm uppercase tracking-wide text-primary">{siteConfig.name}</p>
        <h1 className="mt-4 max-w-3xl font-heading text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
          {siteConfig.tagline}
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">{siteConfig.description}</p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/approach"
            className="min-h-[44px] rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors duration-200 hover:bg-secondary"
          >
            See our approach
          </Link>
          <Link
            href="/contact"
            className="min-h-[44px] rounded-md border border-border px-6 py-3 font-medium text-foreground transition-colors duration-200 hover:border-primary hover:text-primary"
          >
            Get in touch
          </Link>
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-3">
          {pillars.map((pillar) => (
            <div key={pillar.title}>
              <h2 className="font-heading text-xl text-foreground">{pillar.title}</h2>
              <p className="mt-3 text-muted-foreground">{pillar.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/page.test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/page.test.tsx
git commit -m "Build Home page with thesis-forward hero and pillars"
```

---

### Task 9: Approach page

**Files:**
- Create: `src/app/approach/page.tsx`
- Test: `src/app/approach/page.test.tsx`

**Interfaces:**
- Consumes: `siteConfig` (Task 3)
- Produces: `ApproachPage` default export — reused by the a11y sweep in Task 14

- [ ] **Step 1: Write the failing test**

`src/app/approach/page.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ApproachPage from './page'

describe('ApproachPage', () => {
  it('renders the page heading and all four criteria headings', () => {
    render(<ApproachPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('How we evaluate every deal')
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(4)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- approach`
Expected: FAIL — `src/app/approach/page.tsx` does not exist.

- [ ] **Step 3: Write the implementation**

`src/app/approach/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Approach',
}

const criteria = [
  {
    title: 'Cash flow first',
    body: "Every acquisition has to work on today's numbers. We do not underwrite to speculative rent growth or exit-cap compression.",
  },
  {
    title: 'Downside discipline',
    body: 'We size positions and leverage so that a slower market is an inconvenience, not a threat to the portfolio.',
  },
  {
    title: 'Operational control',
    body: 'We stay close to the assets we own — management, maintenance, and tenant relationships are not outsourced blind spots.',
  },
]

export default function ApproachPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <p className="font-body text-sm uppercase tracking-wide text-primary">Approach</p>
      <h1 className="mt-4 font-heading text-4xl font-semibold text-foreground">
        How we evaluate every deal
      </h1>
      <p className="mt-6 text-lg text-muted-foreground">
        {siteConfig.name} runs two related strategies from one underwriting discipline: buy-and-hold
        acquisitions for long-term capital appreciation, and a smaller book of fix-and-flip projects
        where the margin of safety is clear before we commit capital.
      </p>

      <div className="mt-14 space-y-10">
        {criteria.map((item) => (
          <div key={item.title} className="border-t border-border pt-8">
            <h2 className="font-heading text-2xl text-foreground">{item.title}</h2>
            <p className="mt-3 text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-14 border-t border-border pt-8">
        <h2 className="font-heading text-2xl text-foreground">Buy-and-hold vs. flips</h2>
        <p className="mt-3 text-muted-foreground">
          The default is to hold: assets that compound through appreciation and rent growth stay in
          the portfolio. We take on a flip only when a property has a clear value-add path — a
          renovation or repositioning — and the exit math holds up even if the market softens before
          we sell.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- approach`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/app/approach/page.tsx src/app/approach/page.test.tsx
git commit -m "Build Approach page"
```

---

### Task 10: About page

**Files:**
- Create: `src/app/about/page.tsx`
- Test: `src/app/about/page.test.tsx`

**Interfaces:**
- Consumes: `siteConfig` (Task 3)
- Produces: `AboutPage` default export — reused by the a11y sweep in Task 14

- [ ] **Step 1: Write the failing test**

`src/app/about/page.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AboutPage from './page'
import { siteConfig } from '@/lib/site-config'

describe('AboutPage', () => {
  it('renders an h1 referencing the site name and the market focus in body copy', () => {
    render(<AboutPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(siteConfig.name)
    expect(screen.getByText(new RegExp(siteConfig.marketFocus))).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- about`
Expected: FAIL — `src/app/about/page.tsx` does not exist.

- [ ] **Step 3: Write the implementation**

`src/app/about/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'About',
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <p className="font-body text-sm uppercase tracking-wide text-primary">About</p>
      <h1 className="mt-4 font-heading text-4xl font-semibold text-foreground">
        Why {siteConfig.name} exists
      </h1>

      <div className="mt-8 space-y-6 text-lg text-muted-foreground">
        <p>
          {siteConfig.name} was founded on a simple premise: real estate rewards patience and
          discipline more than it rewards speed. Every acquisition is evaluated against the same
          underwriting standard, whether it is a long-term hold or a shorter renovation project.
        </p>
        <p>
          We are building this firm deliberately — starting with a focused market, a small number of
          well-underwritten deals, and a willingness to pass on anything that does not clear our bar.
          The plan is to earn a track record the same way we plan to earn returns: one disciplined
          decision at a time.
        </p>
        <p>
          Our starting focus is {siteConfig.marketFocus}, with room to expand as the strategy proves
          out. We work directly with real estate professionals who bring us deals, and with investors
          who want a partner that treats their capital like it is our own.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- about`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/app/about/page.tsx src/app/about/page.test.tsx
git commit -m "Build About page"
```

---

### Task 11: Contact form component

**Files:**
- Create: `src/components/contact/ContactForm.tsx`
- Test: `src/components/contact/ContactForm.test.tsx`

**Interfaces:**
- Consumes: `contactFormSchema`, `type ContactFormValues` (Task 4)
- Produces: `ContactForm` component that POSTs to `/api/contact` — consumed by the Contact page (Task 13); the API contract it expects (`POST /api/contact` returning `{ message: string }` with 2xx on success) is what Task 12 must implement

- [ ] **Step 1: Write the failing tests**

`src/components/contact/ContactForm.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ContactForm } from './ContactForm'

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Jamie Rivera' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jamie@example.com' } })
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: 'I would like to learn more about your fund.' },
  })
}

describe('ContactForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('shows an inline error when a required field is blurred empty', () => {
    render(<ContactForm />)
    const nameInput = screen.getByLabelText('Full name')
    fireEvent.blur(nameInput)
    expect(screen.getByText('Enter your full name.')).toBeInTheDocument()
  })

  it('disables the submit button while submitting', async () => {
    let resolveFetch: (value: unknown) => void = () => {}
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve
      }),
    )

    render(<ContactForm />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled()
    })

    resolveFetch({ ok: true, json: async () => ({ message: 'Sent' }) })
  })

  it('shows a success message after a successful submit', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Sent' }),
    })

    render(<ContactForm />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByRole('status')).toHaveTextContent(/thank you/i)
  })

  it('shows an error message when the request fails', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'The contact form is not configured yet.' }),
    })

    render(<ContactForm />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('The contact form is not configured yet.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- ContactForm`
Expected: FAIL — `ContactForm.tsx` does not exist.

- [ ] **Step 3: Write the implementation**

`src/components/contact/ContactForm.tsx`:
```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { contactFormSchema, type ContactFormValues } from '@/lib/contact-schema'

type FieldErrors = Partial<Record<keyof ContactFormValues, string>>
type Status = 'idle' | 'submitting' | 'success' | 'error'

const initialValues: ContactFormValues = {
  intent: 'investor',
  name: '',
  email: '',
  message: '',
}

export function ContactForm() {
  const [values, setValues] = useState<ContactFormValues>(initialValues)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [status, setStatus] = useState<Status>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)

  function validateField(field: keyof ContactFormValues, nextValues: ContactFormValues) {
    const result = contactFormSchema.safeParse(nextValues)
    if (result.success) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
      return
    }
    const issue = result.error.issues.find((i) => i.path[0] === field)
    setErrors((prev) => ({ ...prev, [field]: issue?.message }))
  }

  function handleChange<K extends keyof ContactFormValues>(field: K, value: ContactFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function handleBlur(field: keyof ContactFormValues) {
    validateField(field, values)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = contactFormSchema.safeParse(values)
    if (!result.success) {
      const nextErrors: FieldErrors = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof ContactFormValues
        nextErrors[field] = issue.message
      }
      setErrors(nextErrors)
      return
    }

    setStatus('submitting')
    setSubmitError(null)

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(body?.message ?? 'Something went wrong. Please try again.')
      }

      setStatus('success')
      setValues(initialValues)
      setErrors({})
    } catch (error) {
      setStatus('error')
      setSubmitError(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
    }
  }

  if (status === 'success') {
    return (
      <div role="status" className="rounded-lg border border-border bg-card p-6 text-foreground">
        <p className="font-heading text-xl">Thank you — your message is on its way.</p>
        <p className="mt-2 text-muted-foreground">We read every message and will follow up directly.</p>
      </div>
    )
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-6">
      <fieldset>
        <legend className="mb-2 font-medium text-foreground">I am reaching out as a...</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="intent"
              value="investor"
              checked={values.intent === 'investor'}
              onChange={() => handleChange('intent', 'investor')}
              className="h-5 w-5 accent-primary"
            />
            Investor
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="intent"
              value="deal"
              checked={values.intent === 'deal'}
              onChange={() => handleChange('intent', 'deal')}
              className="h-5 w-5 accent-primary"
            />
            I have a deal or listing
          </label>
        </div>
      </fieldset>

      <div>
        <label htmlFor="name" className="mb-1 block font-medium text-foreground">
          Full name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          value={values.name}
          onChange={(e) => handleChange('name', e.target.value)}
          onBlur={() => handleBlur('name')}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'name-error' : undefined}
          className="min-h-[44px] w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        {errors.name && (
          <p id="name-error" role="alert" className="mt-1 text-sm text-destructive">
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block font-medium text-foreground">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => handleChange('email', e.target.value)}
          onBlur={() => handleBlur('email')}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className="min-h-[44px] w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        {errors.email && (
          <p id="email-error" role="alert" className="mt-1 text-sm text-destructive">
            {errors.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="message" className="mb-1 block font-medium text-foreground">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          value={values.message}
          onChange={(e) => handleChange('message', e.target.value)}
          onBlur={() => handleBlur('message')}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? 'message-error' : undefined}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        {errors.message && (
          <p id="message-error" role="alert" className="mt-1 text-sm text-destructive">
            {errors.message}
          </p>
        )}
      </div>

      {status === 'error' && submitError && (
        <p role="alert" aria-live="polite" className="text-sm text-destructive">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="min-h-[44px] rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground transition-colors duration-200 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === 'submitting' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- ContactForm`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/contact/ContactForm.tsx src/components/contact/ContactForm.test.tsx
git commit -m "Add contact form with inline validation and submit states"
```

---

### Task 12: Contact API route

**Files:**
- Create: `src/app/api/contact/route.ts`
- Test: `src/app/api/contact/route.test.ts`
- Create: `.env.example`

**Interfaces:**
- Consumes: `contactFormSchema` (Task 4), `siteConfig` (Task 3), `resend` package (installed in Task 1)
- Produces: `POST /api/contact` endpoint matching the contract `ContactForm` (Task 11) already calls: 400 on invalid payload, 503 when unconfigured, 502 on send failure, 200 `{ message: 'Sent' }` on success

Email delivery uses **Resend** (`resend` npm package) — chosen because it has a minimal API, a free tier, and is commonly used with Vercel deployments. It is isolated to this one file: swapping providers later means rewriting this route only, nothing else in the codebase touches it.

- [ ] **Step 1: Write the failing tests**

`src/app/api/contact/route.test.ts`:
```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sendMock = vi.fn()

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}))

const validPayload = {
  intent: 'investor',
  name: 'Jamie Rivera',
  email: 'jamie@example.com',
  message: 'I would like to learn more about your fund.',
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/contact', () => {
  beforeEach(() => {
    sendMock.mockReset()
    vi.stubEnv('RESEND_API_KEY', 're_test_key')
    vi.stubEnv('CONTACT_TO_EMAIL', 'founder@example.com')
    vi.stubEnv('CONTACT_FROM_EMAIL', 'site@example.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 400 for an invalid payload', async () => {
    const { POST } = await import('./route')
    const response = await POST(makeRequest({ ...validPayload, email: 'not-an-email' }))
    expect(response.status).toBe(400)
  })

  it('returns 503 when email env vars are not configured', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const { POST } = await import('./route')
    const response = await POST(makeRequest(validPayload))
    expect(response.status).toBe(503)
  })

  it('sends the email and returns 200 for a valid, configured request', async () => {
    sendMock.mockResolvedValue({ data: { id: 'abc' }, error: null })
    const { POST } = await import('./route')
    const response = await POST(makeRequest(validPayload))

    expect(response.status).toBe(200)
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'founder@example.com',
        from: 'site@example.com',
        replyTo: 'jamie@example.com',
      }),
    )
  })

  it('returns 502 when Resend reports a send error', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const { POST } = await import('./route')
    const response = await POST(makeRequest(validPayload))
    expect(response.status).toBe(502)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- route.test`
Expected: FAIL — `src/app/api/contact/route.ts` does not exist.

- [ ] **Step 3: Write the implementation**

`src/app/api/contact/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { contactFormSchema } from '@/lib/contact-schema'
import { siteConfig } from '@/lib/site-config'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = contactFormSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Please check the form and try again.', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const apiKey = process.env.RESEND_API_KEY
  const toEmail = process.env.CONTACT_TO_EMAIL
  const fromEmail = process.env.CONTACT_FROM_EMAIL

  if (!apiKey || !toEmail || !fromEmail) {
    console.error(
      'Contact form submitted but RESEND_API_KEY/CONTACT_TO_EMAIL/CONTACT_FROM_EMAIL is not configured.',
    )
    return NextResponse.json(
      { message: 'The contact form is not configured yet. Please email us directly.' },
      { status: 503 },
    )
  }

  const resend = new Resend(apiKey)
  const { intent, name, email, message } = parsed.data
  const intentLabel = intent === 'investor' ? 'Investor inquiry' : 'Deal / listing submission'

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    replyTo: email,
    subject: `${intentLabel} — ${siteConfig.name}`,
    text: `From: ${name} <${email}>\nType: ${intentLabel}\n\n${message}`,
  })

  if (error) {
    console.error('Resend send failed', error)
    return NextResponse.json(
      { message: 'We could not send your message. Please try again in a moment.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ message: 'Sent' }, { status: 200 })
}
```

`.env.example`:
```
RESEND_API_KEY=
CONTACT_TO_EMAIL=
CONTACT_FROM_EMAIL=
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- route.test`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/contact/route.ts src/app/api/contact/route.test.ts .env.example
git commit -m "Add contact API route with Resend email delivery"
```

---

### Task 13: Contact page

**Files:**
- Create: `src/app/contact/page.tsx`
- Test: `src/app/contact/page.test.tsx`

**Interfaces:**
- Consumes: `ContactForm` (Task 11), `siteConfig` (Task 3)
- Produces: `ContactPage` default export — reused by the a11y sweep in Task 14

- [ ] **Step 1: Write the failing test**

`src/app/contact/page.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ContactPage from './page'

describe('ContactPage', () => {
  it('renders the heading and the contact form fields', () => {
    render(<ContactPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Let's talk")
    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Message')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/contact/page.test`
Expected: FAIL — `src/app/contact/page.tsx` does not exist.

- [ ] **Step 3: Write the implementation**

`src/app/contact/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { ContactForm } from '@/components/contact/ContactForm'
import { siteConfig } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Contact',
}

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
      <p className="font-body text-sm uppercase tracking-wide text-primary">Contact</p>
      <h1 className="mt-4 font-heading text-4xl font-semibold text-foreground">Let&apos;s talk</h1>
      <p className="mt-6 text-lg text-muted-foreground">
        Whether you are exploring an investment or have a deal you think fits {siteConfig.name}, tell
        us a bit about it below.
      </p>

      <div className="mt-12">
        <ContactForm />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/contact/page.test`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/app/contact/page.tsx src/app/contact/page.test.tsx
git commit -m "Build Contact page"
```

---

### Task 14: Accessibility sweep + manual QA pass

**Files:**
- Create: `src/app/a11y.test.tsx`

**Interfaces:**
- Consumes: `HomePage` (Task 8), `ApproachPage` (Task 9), `AboutPage` (Task 10), `ContactPage` (Task 13)
- Produces: an automated regression guard against WCAG violations on all four pages

- [ ] **Step 1: Write the automated a11y test**

`src/app/a11y.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import HomePage from './page'
import ApproachPage from './approach/page'
import AboutPage from './about/page'
import ContactPage from './contact/page'

expect.extend(toHaveNoViolations)
vi.stubGlobal('fetch', vi.fn())

describe('page accessibility', () => {
  it('home page has no axe violations', async () => {
    const { container } = render(<HomePage />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('approach page has no axe violations', async () => {
    const { container } = render(<ApproachPage />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('about page has no axe violations', async () => {
    const { container } = render(<AboutPage />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('contact page has no axe violations', async () => {
    const { container } = render(<ContactPage />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

- [ ] **Step 2: Run the test and fix any reported violations**

Run: `npm test -- a11y`
Expected: PASS (4 tests). If axe reports a violation (e.g. a missing accessible name), fix the specific element in the page/component file it points to and re-run.

- [ ] **Step 3: Manual QA pass**

Run: `npm run dev`, then in a browser:
- Resize to 375px, 768px, 1024px, 1440px — confirm no horizontal scroll and the mobile menu works at 375px.
- Toggle OS light/dark mode — confirm both the navy/gold and light/amber variants render with readable text (this is what Task 2's `prefers-color-scheme` block drives).
- Enable "reduce motion" in OS settings — confirm hover/focus transitions are unaffected in a jarring way (they're short opacity/color transitions, not motion-heavy, so no `prefers-reduced-motion` media query is required, but confirm nothing animates position/size).
- Tab through every page with the keyboard only — confirm the skip link appears on first Tab and focus rings are visible throughout.

- [ ] **Step 4: Commit**

```bash
git add src/app/a11y.test.tsx
git commit -m "Add automated accessibility regression sweep"
```

---

### Task 15: Production build verification and deploy

**Files:** none (verification + deployment only)

**Interfaces:**
- Consumes: the complete app from Tasks 1–14
- Produces: a live Vercel deployment

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all test files green.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: build succeeds with all 4 routes (`/`, `/approach`, `/about`, `/contact`) plus `/api/contact` listed in the output, no type or lint errors.

- [ ] **Step 3: Set environment variables for the contact form**

The contact form will return a 503 in production until these are set. In the Vercel project settings (or via `vercel env add`), add:
- `RESEND_API_KEY` — from a Resend account (resend.com), created and owned by the user
- `CONTACT_TO_EMAIL` — the address that should receive submissions
- `CONTACT_FROM_EMAIL` — a sender address verified in Resend

This step requires the user's own Resend account credentials — do not create or guess these values.

- [ ] **Step 4: Deploy a preview**

Invoke the `vercel:deploy` skill (or run `vercel deploy` if the Vercel CLI is already linked and authenticated) to create a preview deployment. Share the preview URL with the user for review before promoting to production.

- [ ] **Step 5: Commit any final fixes**

If the build or deploy step surfaces fixes, commit them individually with descriptive messages before promoting to production.
