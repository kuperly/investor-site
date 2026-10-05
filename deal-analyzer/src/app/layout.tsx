import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { setUser } from './actions'
import { currentUser } from '@/lib/session'
import { USERS } from '@/lib/users'
import './globals.css'

export const metadata: Metadata = {
  title: 'ValeForge Deal Analyzer',
  description: 'Internal underwriting engine',
  robots: { index: false, follow: false },
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <header className="no-print border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <Link href="/" className="mr-2 text-base font-bold tracking-tight text-brand">
              ValeForge <span className="font-normal text-ink-muted">Deal Analyzer</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/" className="rounded px-2 py-2 hover:bg-slate-100">Deals</Link>
              <Link href="/settings" className="rounded px-2 py-2 hover:bg-slate-100">Defaults</Link>
              <Link href="/methodology" className="rounded px-2 py-2 hover:bg-slate-100">Methodology</Link>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <form action={setUser} className="flex items-center gap-1 text-sm" aria-label="Current user">
                <span className="text-ink-muted">User:</span>
                {USERS.map((u) => (
                  <button
                    key={u}
                    name="user"
                    value={u}
                    className={`min-h-[36px] rounded px-2.5 py-1 ${u === user ? 'bg-brand text-white' : 'border border-slate-300 hover:bg-slate-50'}`}
                    aria-pressed={u === user}
                  >
                    {u}
                  </button>
                ))}
              </form>
              <Link href="/deals/new" className="btn-primary">+ New Deal</Link>
            </div>
          </div>
          {!user && (
            <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
              Select who you are (Guy or Ben) — every change is recorded in the audit trail.
            </div>
          )}
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-5">{children}</main>
      </body>
    </html>
  )
}
