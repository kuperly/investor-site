import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/LoginForm'
import { authDisabled, sessionSecret } from '@/lib/auth/token'
import { currentUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (authDisabled() || (await currentUser())) redirect('/')
  const { next } = await searchParams
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-xl font-bold text-brand">ValeForge</h1>
      <p className="mb-4 text-sm text-ink-soft">Sign in to continue.</p>
      {!sessionSecret() ? (
        <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
          Sign-in is not configured on this server. Set SESSION_SECRET in the deployment environment.
        </p>
      ) : (
        <div className="card">
          <LoginForm next={next ?? ''} />
        </div>
      )}
    </main>
  )
}
