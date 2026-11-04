import 'server-only'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { __dgfitSql?: ReturnType<typeof postgres> }

// postgres() bağlantıyı ilk sorguda açar; build sırasında DATABASE_URL olmasa da güvenli.
const sql =
  globalForDb.__dgfitSql ??
  postgres(process.env.DATABASE_URL ?? 'postgres://dgfit@127.0.0.1:5432/dgfit', { max: 10, idle_timeout: 30 })
if (process.env.NODE_ENV !== 'production') globalForDb.__dgfitSql = sql

export const db = drizzle({ client: sql, schema })
export { schema }
