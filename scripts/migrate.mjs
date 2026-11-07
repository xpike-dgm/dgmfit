// Basit, bağımlılıksız migration çalıştırıcı: drizzle/*.sql dosyalarını sırayla uygular.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import crypto from 'node:crypto'
import { agToExercise, buildMatcher } from './licensed-map.mjs'

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
  await seedExercises(sql)
  await seedLicensed(sql)
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
    portions: r.portions, approx: r.approx, aliases: r.aliases ?? [], recipe: r.recipe ?? null, search: r.search, brand: r.brand ?? null, barcode: r.barcode ?? null,
    attribution: r.source === 'usda' ? 'USDA FoodData Central' : r.source === 'dgfit' ? 'DgFit tarifi (USDA malzemelerinden hesaplanmış)' : r.source === 'dgfit-label' ? 'Ürün etiketi' : null,
  }))
  const cols = ['source', 'source_id', 'key', 'name_tr', 'name_en', 'category', 'per100', 'kcal', 'protein', 'carb', 'fat', 'portions', 'approx', 'aliases', 'recipe', 'search', 'attribution', 'brand', 'barcode']
  await sql.begin(async (tx) => {
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500).map((r) => ({ ...r, per100: tx.json(r.per100), portions: tx.json(r.portions), aliases: tx.json(r.aliases), recipe: r.recipe ? tx.json(r.recipe) : null }))
      await tx`insert into foods ${tx(batch, ...cols)} on conflict (source, source_id) do update set
        key = excluded.key, name_tr = excluded.name_tr, name_en = excluded.name_en, category = excluded.category, per100 = excluded.per100,
        kcal = excluded.kcal, protein = excluded.protein, carb = excluded.carb, fat = excluded.fat, portions = excluded.portions,
        approx = excluded.approx, aliases = excluded.aliases, recipe = excluded.recipe, search = excluded.search,
        attribution = excluded.attribution, brand = excluded.brand, barcode = excluded.barcode, updated_at = now(), deleted_at = null`
    }
    const ids = rows.map((r) => r.source + ':' + r.source_id)
    await tx`update foods set deleted_at = now() where source in ('usda', 'dgfit', 'dgfit-label') and deleted_at is null and (source || ':' || source_id) <> all(${ids})`
    await tx`insert into app_config (key, value) values ('foods_seed', ${tx.json({ version: seed.version, count: rows.length })})
      on conflict (key) do update set value = excluded.value`
  })
  console.log('besin verisi yüklendi:', rows.length, 'satır, sürüm', seed.version)
}

/** data/exercises-seed.json.gz sürümü değiştiyse free-exercise-db hareketlerini yükler (kullanıcı hareketlerine dokunmaz). */
async function seedExercises(sql) {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'exercises-seed.json.gz')
  if (!fs.existsSync(file)) { console.log('hareket verisi yok, atlandı'); return }
  const zlib = await import('node:zlib')
  const seed = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString())
  const [cur] = await sql`select value from app_config where key = 'exercises_seed'`
  if (cur?.value?.version === seed.version) { console.log('hareket verisi güncel', seed.version); return }
  const cols = ['key', 'source', 'name_tr', 'name_en', 'aliases', 'category', 'equipment', 'level', 'force', 'mechanic', 'primary_muscles', 'secondary_muscles', 'kind', 'pattern', 'images', 'steps', 'mistakes', 'curated', 'search']
  await sql.begin(async (tx) => {
    for (let i = 0; i < seed.items.length; i += 300) {
      const batch = seed.items.slice(i, i + 300).map((x) => ({
        key: x.key, source: 'fedb', name_tr: x.nameTr, name_en: x.nameEn, aliases: tx.json(x.aliases), category: x.category, equipment: x.equipment,
        level: x.level ?? null, force: x.force, mechanic: x.mechanic, primary_muscles: tx.json(x.primary), secondary_muscles: tx.json(x.secondary),
        kind: x.kind, pattern: x.pattern, images: tx.json(x.images), steps: tx.json(x.steps), mistakes: tx.json(x.mistakes), curated: x.curated, search: x.search,
      }))
      await tx`insert into exercises ${tx(batch, ...cols)} on conflict (key) do update set
        name_tr = excluded.name_tr, name_en = excluded.name_en, aliases = excluded.aliases, category = excluded.category, equipment = excluded.equipment,
        level = excluded.level, force = excluded.force, mechanic = excluded.mechanic, primary_muscles = excluded.primary_muscles,
        secondary_muscles = excluded.secondary_muscles, kind = excluded.kind, pattern = excluded.pattern, images = excluded.images,
        steps = excluded.steps, mistakes = excluded.mistakes, curated = excluded.curated, search = excluded.search, deleted_at = null`
    }
    const keys = seed.items.map((x) => x.key)
    await tx`update exercises set deleted_at = now() where source = 'fedb' and deleted_at is null and key <> all(${keys})`
    await tx`insert into app_config (key, value) values ('exercises_seed', ${tx.json({ version: seed.version, count: seed.items.length })})
      on conflict (key) do update set value = excluded.value`
  })
  console.log('hareket verisi yüklendi:', seed.items.length, 'sürüm', seed.version)
}

/**
 * Lisanslı içerik paketi (Ağırsağlam; DgFit'e özel yazılı izin, memory/DECISIONS.md). Paket depoda değil: sunucuda
 * DGFIT_LICENSED_DIR (ör. /licensed/agirsaglam) altında. Kütüphanede adı eşleşen harekete ek veri yazılır, eşleşmeyenler
 * source='agirsaglam' olarak eklenir. Paket yoksa hiçbir şey yapılmaz.
 */
async function seedLicensed(sql) {
  const dir = process.env.DGFIT_LICENSED_DIR
  const file = dir && path.join(dir, 'exercises.json')
  if (!file || !fs.existsSync(file)) { console.log('lisanslı paket yok, atlandı'); return }
  const raw = fs.readFileSync(file)
  const version = crypto.createHash('sha256').update(raw).update(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'licensed-map.mjs'))).digest('hex').slice(0, 12)
  const [cur] = await sql`select value from app_config where key = 'licensed_agirsaglam'`
  if (cur?.value?.version === version) { console.log('lisanslı paket güncel', version); return }
  const items = JSON.parse(raw.toString()).map(agToExercise).filter((e) => e.name)
  const lib = await sql`select key, coalesce(name_en, name_tr) as name from exercises where source = 'fedb' and deleted_at is null`
  const match = buildMatcher(lib)
  let merged = 0, added = 0
  await sql.begin(async (tx) => {
    await tx`update exercises set licensed = null where source = 'fedb' and licensed is not null`
    for (const e of items) {
      const key = match(e.name)
      if (key) { await tx`update exercises set licensed = ${tx.json(e.licensed)} where key = ${key}`; merged++; continue }
      const row = {
        key: e.key, source: 'agirsaglam', name_tr: e.name, name_en: e.nameEn, aliases: tx.json([]), category: e.category, equipment: e.equipment, level: e.level,
        force: null, mechanic: e.mechanic, primary_muscles: tx.json(e.primary), secondary_muscles: tx.json(e.secondary), kind: e.kind, pattern: e.pattern,
        images: tx.json([]), steps: tx.json([]), mistakes: tx.json([]), curated: true, search: e.search, licensed: tx.json(e.licensed),
      }
      await tx`insert into exercises ${tx(row)} on conflict (key) do update set name_tr = excluded.name_tr, name_en = excluded.name_en, equipment = excluded.equipment,
        level = excluded.level, mechanic = excluded.mechanic, primary_muscles = excluded.primary_muscles, secondary_muscles = excluded.secondary_muscles, kind = excluded.kind,
        pattern = excluded.pattern, search = excluded.search, licensed = excluded.licensed, deleted_at = null`
      added++
    }
    await tx`insert into app_config (key, value) values ('licensed_agirsaglam', ${tx.json({ version, merged, added })}) on conflict (key) do update set value = excluded.value`
  })
  console.log('lisanslı paket yüklendi:', merged, 'eşleşen +', added, 'yeni hareket, sürüm', version)
}
