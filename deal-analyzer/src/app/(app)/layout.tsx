import Link from 'next/link'
import { signOut } from '@/app/auth-actions'
import { AppNav } from '@/components/AppNav'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  return (
    <>
      <header className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <AppNav isAdmin={user.role === 'admin'} />
          <div className="ml-auto flex items-center gap-2 text-sm">
            {user.openAccess ? (
              <span className="rounded bg-amber-100 px-2 py-1 text-amber-900">
                Login is off — changes are recorded as “{user.displayName}”
              </span>
            ) : (
              <>
                <Link href="/account" className="rounded px-2 py-2 text-ink-soft hover:bg-slate-100">
                  {user.displayName}
                </Link>
                <form action={signOut}>
                  <button className="btn-secondary min-h-[36px] py-1">Sign out</button>
                </form>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-5">{children}</main>
    </>
  )
}
