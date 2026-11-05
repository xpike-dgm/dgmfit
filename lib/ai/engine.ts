import 'server-only'
import crypto from 'node:crypto'
import { and, eq, gte, isNull, sql } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { db, schema } from '../db'
import { dayString } from '../time'
import { dayBounds } from '../water-data'
import { classifyError, DEFAULT_USER_DAILY, pickProviders, type ProviderId, type ProviderState } from './policy'
import { jsonSchemaFor, parseResult, TASKS, type Task } from './schemas'

/** Varsayılanlar: kullanıcı kararı (Haiku her yerde); OpenAI modeli resmi belgedeki en verimli model (2026-11-05). */
export const DEFAULT_MODELS: Record<ProviderId, string> = { claude: 'claude-haiku-5-5', openai: 'gpt-6-luna' }
export const PROVIDER_LABEL: Record<ProviderId, string> = { claude: 'Claude (Anthropic)', openai: 'OpenAI' }

export class AiError extends Error {
  constructor(message: string, readonly reason: 'kota' | 'yok' | 'hata') { super(message) }
}

// ───────── Anahtar şifreleme (AES-256-GCM, DGFIT_MEDIA_KEY; AAD sağlayıcıya bağlı) ─────────
function master(): Buffer {
  const k = process.env.DGFIT_MEDIA_KEY ? Buffer.from(process.env.DGFIT_MEDIA_KEY, 'base64') : null
  if (!k || k.length !== 32) throw new Error('Sunucuda şifreleme anahtarı yapılandırılmamış')
  return k
}
export function sealKey(id: ProviderId, key: string) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', master(), iv)
  c.setAAD(Buffer.from('ai-key:' + id))
  const data = Buffer.concat([c.update(key, 'utf8'), c.final()])
  return { keyIv: iv, keyTag: c.getAuthTag(), keyData: data, keyLast4: key.slice(-4) }
}
function openKey(p: typeof schema.aiProviders.$inferSelect): string | null {
  if (!p.keyIv || !p.keyTag || !p.keyData || !p.keyData.length) return null
  const d = crypto.createDecipheriv('aes-256-gcm', master(), p.keyIv)
  d.setAAD(Buffer.from('ai-key:' + p.id))
  d.setAuthTag(p.keyTag)
  return Buffer.concat([d.update(p.keyData), d.final()]).toString('utf8')
}

export async function ensureProviders() {
  await db.insert(schema.aiProviders).values([
    { id: 'claude', priority: 0, model: DEFAULT_MODELS.claude },
    { id: 'openai', priority: 1, model: DEFAULT_MODELS.openai },
  ]).onConflictDoNothing()
  return db.select().from(schema.aiProviders).orderBy(schema.aiProviders.priority)
}

export async function aiSettings(): Promise<{ userDaily: number }> {
  const [r] = await db.select().from(schema.appConfig).where(eq(schema.appConfig.key, 'ai')).limit(1)
  const v = (r?.value ?? {}) as { userDaily?: number }
  return { userDaily: v.userDaily ?? DEFAULT_USER_DAILY }
}

/** Test kancası: yalnızca DGFIT_TEST_HOOKS=1 iken sahte sağlayıcı adresleri (canlıda asla). */
function baseUrl(id: ProviderId): string | undefined {
  if (process.env.DGFIT_TEST_HOOKS !== '1') return undefined
  return id === 'claude' ? process.env.DGFIT_AI_TEST_CLAUDE_URL || undefined : process.env.DGFIT_AI_TEST_OPENAI_URL || undefined
}

interface CallInput { text: string; image?: { mime: string; data: Buffer } }
interface CallOut { json: unknown; inputTokens: number; outputTokens: number }

class ProviderError extends Error { constructor(message: string, readonly status: number | null, readonly code: string | null) { super(message) } }

async function callClaude(key: string, model: string, task: Task, input: CallInput): Promise<CallOut> {
  const client = new Anthropic({ apiKey: key, baseURL: baseUrl('claude'), maxRetries: 0, timeout: 60_000 })
  try {
    const content: Anthropic.ContentBlockParam[] = []
    if (input.image) content.push({ type: 'image', source: { type: 'base64', media_type: input.image.mime as 'image/jpeg', data: input.image.data.toString('base64') } })
    content.push({ type: 'text', text: input.text })
    const r = await client.messages.create({
      model, max_tokens: 4000, system: TASKS[task].system,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: jsonSchemaFor(task) } },
      messages: [{ role: 'user', content }],
    })
    if (r.stop_reason === 'refusal') throw new ProviderError('Model isteği reddetti', 200, 'refusal')
    const text = r.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    return { json: parseResult(task, text), inputTokens: r.usage.input_tokens, outputTokens: r.usage.output_tokens }
  } catch (e) {
    if (e instanceof ProviderError) throw e
    if (e instanceof Anthropic.APIError) throw new ProviderError(e.message, e.status ?? null, ((e.error as { error?: { type?: string } } | undefined)?.error?.type) ?? null)
    throw new ProviderError((e as Error).message, e instanceof Anthropic.APIConnectionError ? null : 200, 'bad_output')
  }
}

async function callOpenAI(key: string, model: string, task: Task, input: CallInput): Promise<CallOut> {
  const client = new OpenAI({ apiKey: key, baseURL: baseUrl('openai'), maxRetries: 0, timeout: 60_000 })
  try {
    const content: OpenAI.Responses.ResponseInputContent[] = [{ type: 'input_text', text: input.text }]
    if (input.image) content.push({ type: 'input_image', image_url: `data:${input.image.mime};base64,${input.image.data.toString('base64')}`, detail: 'auto' })
    const r = await client.responses.create({
      model, instructions: TASKS[task].system, max_output_tokens: 4000,
      input: [{ role: 'user', content }],
      text: { format: { type: 'json_schema', name: 'dgfit_' + task.replace('-', '_'), schema: jsonSchemaFor(task), strict: true } },
    })
    return { json: parseResult(task, r.output_text), inputTokens: r.usage?.input_tokens ?? 0, outputTokens: r.usage?.output_tokens ?? 0 }
  } catch (e) {
    if (e instanceof OpenAI.APIError) throw new ProviderError(e.message, e.status ?? null, (e.code as string | null | undefined) ?? (e.type as string | null | undefined) ?? null)
    throw new ProviderError((e as Error).message, e instanceof OpenAI.APIConnectionError ? null : 200, 'bad_output')
  }
}

async function usageByProvider(): Promise<Map<string, { today: number; month: number }>> {
  const [start] = dayBounds(dayString())
  const monthStart = new Date(start); monthStart.setUTCDate(1)
  const rows = await db.execute<{ provider: string; today: number; month: number }>(sql`
    select provider, coalesce(sum(input_tokens + output_tokens) filter (where created_at >= ${start.toISOString()}), 0)::int as today,
      coalesce(sum(input_tokens + output_tokens), 0)::int as month
    from ai_calls where provider is not null and created_at >= ${monthStart.toISOString()} group by provider`)
  return new Map(rows.map((r) => [r.provider, { today: Number(r.today), month: Number(r.month) }]))
}

export async function userCallsToday(userId: string): Promise<number> {
  const [start] = dayBounds(dayString())
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.aiCalls)
    .where(and(eq(schema.aiCalls.userId, userId), gte(schema.aiCalls.createdAt, start), eq(schema.aiCalls.cached, false), sql`${schema.aiCalls.provider} is not null`))
  return Number(r?.n ?? 0)
}

/**
 * Bir AI görevini çalıştırır: kullanıcı kotası → önbellek → sağlayıcılar öncelik sırasıyla (kota/limit/hata → sonraki).
 * Dönen JSON görev şemasıyla doğrulanmıştır. İçerik kaydedilmez; yalnızca sağlayıcı, token, süre, hata.
 */
export async function runTask<T extends Task>(userId: string, task: T, input: CallInput): Promise<{ result: ReturnType<typeof parseResult<T>>; provider: ProviderId | 'cache' }> {
  const hash = crypto.createHash('sha256').update(task).update('\0').update(input.text.trim().toLocaleLowerCase('tr-TR')).update('\0').update(input.image ? crypto.createHash('sha256').update(input.image.data).digest('hex') : '').digest('hex')
  const [hit] = await db.select().from(schema.aiCache).where(and(eq(schema.aiCache.hash, hash), gte(schema.aiCache.createdAt, new Date(Date.now() - 30 * 86400_000)))).limit(1)
  if (hit) {
    await db.insert(schema.aiCalls).values({ userId, task, provider: null, ok: true, cached: true })
    return { result: parseResult(task, JSON.stringify(hit.result)), provider: 'cache' }
  }
  const { userDaily } = await aiSettings()
  if ((await userCallsToday(userId)) >= userDaily) throw new AiError(`Bugünkü AI hakkın doldu (${userDaily}). Yarın yenilenir; şimdilik elle ekleyebilirsin.`, 'kota')

  const rows = await ensureProviders()
  const used = await usageByProvider()
  const states: ProviderState[] = rows.map((p) => ({
    id: p.id as ProviderId, enabled: p.enabled, priority: p.priority, hasKey: !!p.keyData?.length,
    dailyTokenLimit: p.dailyTokenLimit, monthlyTokenLimit: p.monthlyTokenLimit, usedToday: used.get(p.id)?.today ?? 0, usedMonth: used.get(p.id)?.month ?? 0, cooldownUntil: p.cooldownUntil,
  }))
  const { usable } = pickProviders(states, new Date())
  if (!usable.length) throw new AiError('AI şu an kullanılamıyor (sağlayıcı yok ya da limitler doldu). Elle eklemeye devam edebilirsin.', 'yok')

  for (const id of usable) {
    const p = rows.find((r) => r.id === id)!
    const t0 = Date.now()
    try {
      const key = openKey(p)
      if (!key) continue
      const out = id === 'claude' ? await callClaude(key, p.model, task, input) : await callOpenAI(key, p.model, task, input)
      await db.insert(schema.aiCalls).values({ userId, task, provider: id, ok: true, inputTokens: out.inputTokens, outputTokens: out.outputTokens, ms: Date.now() - t0 })
      await db.insert(schema.aiCache).values({ hash, task, result: out.json as object, provider: id }).onConflictDoNothing()
      if (p.lastError) await db.update(schema.aiProviders).set({ cooldownUntil: null }).where(eq(schema.aiProviders.id, id))
      return { result: out.json as never, provider: id }
    } catch (e) {
      const pe = e instanceof ProviderError ? e : new ProviderError((e as Error).message, null, null)
      const c = classifyError(pe.code === 'refusal' || pe.code === 'bad_output' ? 400 : pe.status, pe.code)
      const kind = pe.code === 'refusal' ? 'refusal' : pe.code === 'bad_output' ? 'bad_output' : c.kind
      await db.insert(schema.aiCalls).values({ userId, task, provider: id, ok: false, ms: Date.now() - t0, error: `${kind}${pe.status ? ' ' + pe.status : ''}: ${pe.message.slice(0, 160)}` })
      await db.update(schema.aiProviders).set({
        lastError: `${kind}${pe.status ? ' ' + pe.status : ''}${pe.code ? ' ' + pe.code : ''}`, lastErrorAt: new Date(),
        ...(c.cooldownMs && kind !== 'refusal' && kind !== 'bad_output' ? { cooldownUntil: new Date(Date.now() + c.cooldownMs) } : {}),
      }).where(eq(schema.aiProviders.id, id))
      console.error('[dgfit] AI sağlayıcı hatası', id, kind, pe.status)
    }
  }
  throw new AiError('AI yanıt veremedi. Biraz sonra tekrar dene ya da elle ekle.', 'hata')
}

/** Yönetici ekranı için durum. Anahtarın kendisi asla dönmez. */
export async function providerOverview() {
  const rows = await ensureProviders()
  const used = await usageByProvider()
  const { skipped } = pickProviders(rows.map((p) => ({
    id: p.id as ProviderId, enabled: p.enabled, priority: p.priority, hasKey: !!p.keyData?.length, dailyTokenLimit: p.dailyTokenLimit, monthlyTokenLimit: p.monthlyTokenLimit,
    usedToday: used.get(p.id)?.today ?? 0, usedMonth: used.get(p.id)?.month ?? 0, cooldownUntil: p.cooldownUntil,
  })), new Date())
  const [start] = dayBounds(dayString())
  const calls = await db.select({ provider: schema.aiCalls.provider, ok: schema.aiCalls.ok, cached: schema.aiCalls.cached, n: sql<number>`count(*)::int` })
    .from(schema.aiCalls).where(gte(schema.aiCalls.createdAt, start)).groupBy(schema.aiCalls.provider, schema.aiCalls.ok, schema.aiCalls.cached)
  return {
    providers: rows.map((p) => ({
      id: p.id as ProviderId, label: PROVIDER_LABEL[p.id as ProviderId] ?? p.id, enabled: p.enabled, priority: p.priority, model: p.model, keyLast4: p.keyData?.length ? p.keyLast4 : null,
      dailyTokenLimit: p.dailyTokenLimit, monthlyTokenLimit: p.monthlyTokenLimit, usedToday: used.get(p.id)?.today ?? 0, usedMonth: used.get(p.id)?.month ?? 0,
      cooldownUntil: p.cooldownUntil, lastError: p.lastError, lastErrorAt: p.lastErrorAt, skipped: skipped.find((s) => s.id === p.id)?.reason ?? null,
    })),
    today: calls.map((c) => ({ provider: c.provider, ok: c.ok, cached: c.cached, n: Number(c.n) })),
    settings: await aiSettings(),
  }
}

export async function aiAvailable(): Promise<boolean> {
  const rows = await db.select({ enabled: schema.aiProviders.enabled, keyLast4: schema.aiProviders.keyLast4 }).from(schema.aiProviders).where(and(eq(schema.aiProviders.enabled, true), isNull(schema.aiProviders.cooldownUntil)))
  if (rows.some((r) => r.keyLast4)) return true
  const any = await db.select({ id: schema.aiProviders.id }).from(schema.aiProviders).where(and(eq(schema.aiProviders.enabled, true), sql`${schema.aiProviders.keyLast4} is not null`)).limit(1)
  return any.length > 0
}
