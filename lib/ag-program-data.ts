import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import { and, inArray, isNull, sql } from 'drizzle-orm'
import { db, schema } from './db'
import { LICENSED_DIR, exerciseMedia } from './licensed'
import { AG_NAME_ALIAS, AG_PROGRAM_PREFIX, agKeyResolver, agProgramDays, agSummary, type AgProgram } from './ag-programs'

let cache: { programs: AgProgram[]; agNameToId: Map<string, number> } | null | undefined
/** Paketteki ücretsiz programlar (yalnızca type = Free; PRO izin kapsamı dışında). Paket yoksa boş. */
function load() {
  if (cache !== undefined) return cache
  try {
    const programs = (JSON.parse(fs.readFileSync(path.join(LICENSED_DIR, 'programs.free.json'), 'utf8')) as AgProgram[])
      .filter((p) => p.type === 'Free').sort((a, b) => a.index - b.index)
    const ex = JSON.parse(fs.readFileSync(path.join(LICENSED_DIR, 'exercises.json'), 'utf8')) as { id: number; parameters: { name: string } }[]
    cache = { programs, agNameToId: new Map(ex.map((e) => [e.parameters.name.trim(), e.id])) }
  } catch { cache = null }
  return cache
}

export function agProgramList() { return (load()?.programs ?? []).map(agSummary) }
export function agProgram(id: string) {
  if (!id.startsWith(AG_PROGRAM_PREFIX)) return null
  return load()?.programs.find((p) => p.id === id.slice(AG_PROGRAM_PREFIX.length)) ?? null
}

async function resolver() {
  const c = load()!
  const rows = await db.select({ key: schema.exercises.key, agId: sql<number>`(${schema.exercises.licensed}->>'id')::int` }).from(schema.exercises)
    .where(and(isNull(schema.exercises.userId), isNull(schema.exercises.deletedAt), sql`${schema.exercises.licensed} is not null`))
  const aliasKeys = Object.values(AG_NAME_ALIAS).map((a) => a.key).filter((k): k is string => !!k)
  const lib = aliasKeys.length ? await db.select({ key: schema.exercises.key }).from(schema.exercises).where(and(isNull(schema.exercises.userId), isNull(schema.exercises.deletedAt), inArray(schema.exercises.key, aliasKeys))) : []
  return agKeyResolver(c.agNameToId, new Map(rows.map((r) => [Number(r.agId), r.key])), new Set(lib.map((r) => r.key)))
}

/** Program günleri, hareket anahtarlarıyla (insertProgram için). */
export async function agProgramPlan(id: string) {
  const p = agProgram(id)
  if (!p) return null
  return { program: p, ...agProgramDays(p, await resolver()) }
}

/** Şablon ayrıntı sayfası için: gün → hareket adı, küçük resim, hedef, süperset grubu. */
export async function agProgramPreview(id: string) {
  const plan = await agProgramPlan(id)
  if (!plan) return null
  const keys = [...new Set(plan.days.flatMap((d) => d.exercises.map((e) => e.key)))]
  const rows = keys.length ? await db.select({ id: schema.exercises.id, key: schema.exercises.key, name: schema.exercises.nameTr, images: schema.exercises.images, licensed: schema.exercises.licensed }).from(schema.exercises)
    .where(and(isNull(schema.exercises.userId), inArray(schema.exercises.key, keys))) : []
  const by = new Map(rows.map((r) => [r.key, { id: r.id, name: r.name, image: r.images[0] ?? null, ...exerciseMedia(r.licensed) }]))
  return { ...plan, info: agSummary(plan.program), days: plan.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e, ex: by.get(e.key) ?? null })) })) }
}
