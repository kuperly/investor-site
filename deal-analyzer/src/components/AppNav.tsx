'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Three modules in one deployment, in layer order: Market Intelligence (where to search) →
 * Deal Sourcing (what to chase there) → Deal Analyzer (whether, and at what price).
 */
const MODULES = [
  {
    key: 'markets',
    label: '1 · Markets',
    home: '/markets',
    links: [
      { href: '/markets', label: 'Markets' },
      { href: '/markets/avatars', label: 'Avatars' },
      { href: '/markets/ingestion', label: 'Data' },
      { href: '/markets/methodology', label: 'Methodology' },
    ],
  },
  {
    key: 'sourcing',
    label: '2 · Sourcing',
    home: '/sourcing',
    links: [
      { href: '/sourcing', label: 'Pipeline' },
      { href: '/sourcing/targets', label: 'Targets' },
      { href: '/sourcing/leads', label: 'Leads' },
    ],
  },
  {
    key: 'deals',
    label: '3 · Deal Analyzer',
    home: '/',
    links: [
      { href: '/', label: 'Deals' },
      { href: '/deals/new', label: '+ New deal' },
      { href: '/settings', label: 'Defaults' },
      { href: '/methodology', label: 'Methodology' },
    ],
  },
] as const

export function AppNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname() ?? '/'
  const active = path.startsWith('/markets')
    ? 'markets'
    : path.startsWith('/sourcing')
      ? 'sourcing'
      : path.startsWith('/admin') || path.startsWith('/account')
        ? null
        : 'deals'
  const current = MODULES.find((m) => m.key === active)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="text-base font-bold tracking-tight text-brand">ValeForge</span>
      <nav aria-label="Modules" className="flex rounded-md border border-slate-200 p-0.5 text-sm">
        {MODULES.map((m) => (
          <Link
            key={m.key}
            href={m.home}
            aria-current={m.key === active ? 'page' : undefined}
            className={`rounded px-2.5 py-1.5 ${m.key === active ? 'bg-brand text-white' : 'text-ink-soft hover:bg-slate-100'}`}
          >
            {m.label}
          </Link>
        ))}
      </nav>
      {current && (
        <nav aria-label={current.label} className="flex flex-wrap items-center gap-1 text-sm">
          {current.links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded px-2 py-2 hover:bg-slate-100">
              {l.label}
            </Link>
          ))}
        </nav>
      )}
      {isAdmin && (
        <Link href="/admin/users" className="rounded px-2 py-2 text-sm text-ink-soft hover:bg-slate-100">
          Users
        </Link>
      )}
    </div>
  )
}
