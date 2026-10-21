/** Applies pending versioned migrations (db/migrations) to DATABASE_URL, or to the local PGlite store. */
import { getDb } from '../src/lib/db'

getDb()
  .then(() => {
    console.log(`Migrations applied (${process.env.DATABASE_URL ? 'PostgreSQL' : 'PGlite'}).`)
    process.exit(0)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
