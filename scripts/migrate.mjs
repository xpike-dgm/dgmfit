// Basit, bağımlılıksız migration çalıştırıcı: drizzle/*.sql dosyalarını sırayla uygular.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'drizzle')
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} })
try {
  await sql`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`
  await sql`select pg_advisory_lock(778899)`
  const done = new Set((await sql`select name from _migrations`).map((r) => r.name))
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  for (const f of files) {
    if (done.has(f)) continue
    const parts = fs.readFileSync(path.join(dir, f), 'utf8').split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean)
    await sql.begin(async (tx) => {
      for (const p of parts) await tx.unsafe(p)
      await tx`insert into _migrations (name) values (${f})`
    })
    console.log('migration uygulandı:', f)
  }
  await sql`select pg_advisory_unlock(778899)`
  console.log('migration tamam')
} finally {
  await sql.end()
}
