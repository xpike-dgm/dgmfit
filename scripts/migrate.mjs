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
  await seedFoods(sql)
  await sql`select pg_advisory_unlock(778899)`
  console.log('migration tamam')
} finally {
  await sql.end()
}

/** data/foods-seed.json.gz sürümü değiştiyse USDA + DgFit besinlerini toplu yükler (kullanıcı ve OFF besinlerine dokunmaz). */
async function seedFoods(sql) {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'foods-seed.json.gz')
  if (!fs.existsSync(file)) { console.log('besin verisi yok, atlandı'); return }
  const zlib = await import('node:zlib')
  const seed = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString())
  const [cur] = await sql`select value from app_config where key = 'foods_seed'`
  if (cur?.value?.version === seed.version) { console.log('besin verisi güncel', seed.version); return }
  const rows = seed.rows.map((r) => ({
    source: r.source, source_id: r.sourceId, key: r.key, name_tr: r.nameTr, name_en: r.nameEn, category: r.category,
    per100: r.n, kcal: r.n.kcal ?? 0, protein: r.n.protein ?? 0, carb: r.n.carb ?? 0, fat: r.n.fat ?? 0,
    portions: r.portions, approx: r.approx, aliases: r.aliases ?? [], recipe: r.recipe ?? null, search: r.search,
    attribution: r.source === 'usda' ? 'USDA FoodData Central' : r.source === 'dgfit' ? 'DgFit tarifi (USDA malzemelerinden hesaplanmış)' : null,
  }))
  const cols = ['source', 'source_id', 'key', 'name_tr', 'name_en', 'category', 'per100', 'kcal', 'protein', 'carb', 'fat', 'portions', 'approx', 'aliases', 'recipe', 'search', 'attribution']
  await sql.begin(async (tx) => {
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500).map((r) => ({ ...r, per100: tx.json(r.per100), portions: tx.json(r.portions), aliases: tx.json(r.aliases), recipe: r.recipe ? tx.json(r.recipe) : null }))
      await tx`insert into foods ${tx(batch, ...cols)} on conflict (source, source_id) do update set
        key = excluded.key, name_tr = excluded.name_tr, name_en = excluded.name_en, category = excluded.category, per100 = excluded.per100,
        kcal = excluded.kcal, protein = excluded.protein, carb = excluded.carb, fat = excluded.fat, portions = excluded.portions,
        approx = excluded.approx, aliases = excluded.aliases, recipe = excluded.recipe, search = excluded.search,
        attribution = excluded.attribution, updated_at = now(), deleted_at = null`
    }
    const ids = rows.map((r) => r.source + ':' + r.source_id)
    await tx`update foods set deleted_at = now() where source in ('usda', 'dgfit') and deleted_at is null and (source || ':' || source_id) <> all(${ids})`
    await tx`insert into app_config (key, value) values ('foods_seed', ${tx.json({ version: seed.version, count: rows.length })})
      on conflict (key) do update set value = excluded.value`
  })
  console.log('besin verisi yüklendi:', rows.length, 'satır, sürüm', seed.version)
}
