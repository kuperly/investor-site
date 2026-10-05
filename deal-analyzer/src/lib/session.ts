import { cookies } from 'next/headers'
import { asUser, USER_COOKIE, type User } from './users'

export async function currentUser(): Promise<User | null> {
  return asUser((await cookies()).get(USER_COOKIE)?.value)
}
