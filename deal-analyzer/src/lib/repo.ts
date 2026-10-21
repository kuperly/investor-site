import { getDb } from './db'
import { dealsRepo } from './deals-repo'

export async function repo() {
  return dealsRepo(await getDb())
}
