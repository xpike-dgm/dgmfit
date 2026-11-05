import 'server-only'
import crypto from 'node:crypto'
import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { db, schema } from '../db'
import { dayString } from '../time'
import { dayBounds } from '../water-data'
import { classifyError, DEFAULT_USER_DAILY, pickProviders, type ProviderId, type ProviderState } from './policy'
import { jsonSchemaFor, parseResult, TASKS, USER_QUOTA_TASKS, type Task } from './schemas'

/** Varsayılanlar: kullanıcı kararı (Haiku her yerde); OpenAI modeli resmi belgedeki en verimli model (2026-11-05). */
export const DEFAULT_MODELS: Record<ProviderId, string> = { claude: 'claude-haiku-5-5', openai: 'gpt-6-luna' }
/** Karma model (kullanıcı kararı 2026-11-05): fotoğraf ve etiket Claude Opus 5.5, yazılı kayıt Haiku 5.5. */
export const DEFAULT_TASK_MODELS: Record<ProviderId, Partial<Record<Task, string>>> = { claude: { 'meal-photo': 'claude-opus-5-5', label: 'claude-opus-5-5', restaurant: 'claude-opus-5-5' }, openai: {} }
/** Milyon token başına $ (giriş, çıkış). Kaynak: claude-api rehberi model tablosu (2026-10-06) ve OpenAI fiyat sayfası (2026-11-05). Yalnızca tahmin ekranı için. */
export const PRICES: Record<string, [number, number]> = {
  'claude-opus-5-5': [4, 20], 'claude-haiku-5-5': [0.1, 0.5], 'claude-sonnet-5-5': [2, 10], 'gpt-6-luna': [0.1, 0.5],
}
export const modelFor = (p: { model: string; taskModels: Record<string, string> | null }, task: Task) => (p.taskModels ?? {})[task] || p.model
/** Sunucu tarafı yedek (refusal → başka model) bu modellerde var; Haiku'da yok. */
const SERVER_FALLBACK = /^claude-(opus|fable|sonnet-5-5)/
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
    { id: 'claude', priority: 0, model: DEFAULT_MODELS.claude, taskModels: DEFAULT_TASK_MODELS.claude as Record<string, string> },
    { id: 'openai', priority: 1, model: DEFAULT_MODELS.openai, taskModels: {} },
  ]).onConflictDoNothing()
  return db.select().from(schema.aiProviders).orderBy(schema.aiProviders.priority)
}

export async function aiSettings(): Promise<{ userDaily: number }> {
  const [r] = await db.select().from(schema.appConfig).where(eq(schema.appConfig.key, 'ai')).limit(1)
  const v = (r?.value ?? {}) as { userDaily?: number }
  return { userDaily: v.userDaily ?? DEFAULT_USER_DAILY }
}

/** Test kancası: yalnızca DGFIT_TEST_HOOKS=1 iken sahte sağlayıcı adresleri (canlıda asla). */
/** Resmi API adresleri açıkça verilir: SDK'lar ANTHROPIC_BASE_URL / OPENAI_BASE_URL ortam değişkenine düşmesin. */
const OFFICIAL: Record<ProviderId, string> = { claude: 'https://api.anthropic.com', openai: 'https://api.openai.com/v1' }
function baseUrl(id: ProviderId): string {
  if (process.env.DGFIT_TEST_HOOKS === '1') {
    const t = id === 'claude' ? process.env.DGFIT_AI_TEST_CLAUDE_URL : process.env.DGFIT_AI_TEST_OPENAI_URL
    if (t) return t
  }
  return OFFICIAL[id]
}

/** `system`: görev talimatına eklenen bağlam/kişilik; `history`: önceki sohbet (eskiden yeniye). */
export interface CallInput { text: string; image?: { mime: string; data: Buffer }; system?: string; history?: { role: 'user' | 'assistant'; text: string }[] }
const systemFor = (task: Task, input: CallInput) => (input.system ? TASKS[task].system + '\n\n' + input.system : TASKS[task].system)
interface CallOut { json: unknown; inputTokens: number; outputTokens: number }

class ProviderError extends Error { constructor(message: string, readonly status: number | null, readonly code: string | null) { super(message) } }

async function callClaude(key: string, model: string, task: Task, input: CallInput): Promise<CallOut> {
  // authToken: null → ortamdaki ANTHROPIC_AUTH_TOKEN ya da profil devreye girmez; yalnızca şifreli saklanan anahtar (SDK 1.x: Authorization: Bearer)
  const client = new Anthropic({ apiKey: key, authToken: null, baseURL: baseUrl('claude'), maxRetries: 0, timeout: 60_000 })
  try {
    const content: Anthropic.ContentBlockParam[] = []
    if (input.image) content.push({ type: 'image', source: { type: 'base64', media_type: input.image.mime as 'image/jpeg', data: input.image.data.toString('base64') } })
    content.push({ type: 'text', text: input.text })
    const params = {
      model, max_tokens: SERVER_FALLBACK.test(model) ? 8000 : 4000, system: systemFor(task, input),
      output_config: { effort: 'low' as const, format: { type: 'json_schema' as const, schema: jsonSchemaFor(task) } },
      messages: [...(input.history ?? []).map((h) => ({ role: h.role, content: h.text })), { role: 'user' as const, content }],
    }
    // Opus 5.5 (ve diğer destekleyenler): güvenlik reddinde aynı çağrı içinde sunucu tarafı yedek model ("default" yönlendirme)
    const r = SERVER_FALLBACK.test(model)
      ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await client.messages.create(params)
    if (r.stop_reason === 'refusal') throw new ProviderError('Model isteği reddetti', 200, 'refusal')
    if (r.stop_reason === 'max_tokens') throw new ProviderError('Yanıt yarıda kesildi', 200, 'bad_output')
    const text = (r.content as { type: string; text?: string }[]).flatMap((b) => (b.type === 'text' && b.text ? [b.text] : [])).join('')
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
      model, instructions: systemFor(task, input), max_output_tokens: 4000,
      input: [...(input.history ?? []).map((h) => ({ role: h.role, content: h.text })), { role: 'user' as const, content }],
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
    .where(and(eq(schema.aiCalls.userId, userId), gte(schema.aiCalls.createdAt, start), eq(schema.aiCalls.cached, false), eq(schema.aiCalls.ok, true), inArray(schema.aiCalls.task, USER_QUOTA_TASKS)))
  return Number(r?.n ?? 0)
}

/**
 * Bir AI görevini çalıştırır: kullanıcı kotası → önbellek → sağlayıcılar öncelik sırasıyla (kota/limit/hata → sonraki).
 * Dönen JSON görev şemasıyla doğrulanmıştır. İçerik kaydedilmez; yalnızca sağlayıcı, token, süre, hata.
 */
export async function runTask<T extends Task>(userId: string, task: T, input: CallInput, opts: { cache?: boolean } = {}): Promise<{ result: ReturnType<typeof parseResult<T>>; provider: ProviderId | 'cache' }> {
  // Önbellek yalnızca bağlamsız görevlerde (fotoğraf/metin/etiket); koç ve rapor kişisel bağlam taşır
  const useCache = opts.cache ?? (!input.system && !input.history?.length)
  const hash = crypto.createHash('sha256').update(task).update('\0').update(input.text.trim().toLocaleLowerCase('tr-TR')).update('\0').update(input.image ? crypto.createHash('sha256').update(input.image.data).digest('hex') : '').digest('hex')
  const [hit] = useCache ? await db.select().from(schema.aiCache).where(and(eq(schema.aiCache.hash, hash), gte(schema.aiCache.createdAt, new Date(Date.now() - 30 * 86400_000)))).limit(1) : []
  if (hit) {
    await db.insert(schema.aiCalls).values({ userId, task, provider: null, ok: true, cached: true })
    return { result: parseResult(task, JSON.stringify(hit.result)), provider: 'cache' }
  }
  const { userDaily } = await aiSettings()
  if (USER_QUOTA_TASKS.includes(task) && (await userCallsToday(userId)) >= userDaily) throw new AiError(`Bugünkü AI hakkın doldu (${userDaily}). Yarın yenilenir; şimdilik elle ekleyebilirsin.`, 'kota')

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
      const model = modelFor(p, task)
      const out = id === 'claude' ? await callClaude(key, model, task, input) : await callOpenAI(key, model, task, input)
      await db.insert(schema.aiCalls).values({ userId, task, provider: id, model, ok: true, inputTokens: out.inputTokens, outputTokens: out.outputTokens, ms: Date.now() - t0 })
      if (useCache) await db.insert(schema.aiCache).values({ hash, task, result: out.json as object, provider: id }).onConflictDoNothing()
      if (p.lastError) await db.update(schema.aiProviders).set({ cooldownUntil: null }).where(eq(schema.aiProviders.id, id))
      return { result: out.json as never, provider: id }
    } catch (e) {
      const pe = e instanceof ProviderError ? e : new ProviderError((e as Error).message, null, null)
      const c = classifyError(pe.code === 'refusal' || pe.code === 'bad_output' ? 400 : pe.status, pe.code)
      const kind = pe.code === 'refusal' ? 'refusal' : pe.code === 'bad_output' ? 'bad_output' : c.kind
      await db.insert(schema.aiCalls).values({ userId, task, provider: id, model: modelFor(p, task), ok: false, ms: Date.now() - t0, error: `${kind}${pe.status ? ' ' + pe.status : ''}: ${pe.message.slice(0, 160)}` })
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
  const monthStart = new Date(start); monthStart.setUTCDate(1)
  const byModel = await db.execute<{ model: string; task: string; n: number; inp: number; outp: number }>(sql`
    select model, task, count(*)::int as n, coalesce(sum(input_tokens),0)::int as inp, coalesce(sum(output_tokens),0)::int as outp
    from ai_calls where ok and not cached and model is not null and created_at >= ${monthStart.toISOString()} group by model, task order by model, task`)
  const cost = byModel.map((r) => {
    const pr = PRICES[r.model]
    const usd = pr ? (Number(r.inp) * pr[0] + Number(r.outp) * pr[1]) / 1e6 : null
    return { model: r.model, task: r.task, n: Number(r.n), inputTokens: Number(r.inp), outputTokens: Number(r.outp), usd, perCall: usd !== null && Number(r.n) ? usd / Number(r.n) : null }
  })
  return {
    cost,
    providers: rows.map((p) => ({
      id: p.id as ProviderId, label: PROVIDER_LABEL[p.id as ProviderId] ?? p.id, enabled: p.enabled, priority: p.priority, model: p.model, taskModels: (p.taskModels ?? {}) as Record<string, string>, keyLast4: p.keyData?.length ? p.keyLast4 : null,
      dailyTokenLimit: p.dailyTokenLimit, monthlyTokenLimit: p.monthlyTokenLimit, usedToday: used.get(p.id)?.today ?? 0, usedMonth: used.get(p.id)?.month ?? 0,
      cooldownUntil: p.cooldownUntil, lastError: p.lastError, lastErrorAt: p.lastErrorAt, skipped: skipped.find((s) => s.id === p.id)?.reason ?? null,
    })),
    today: calls.map((c) => ({ provider: c.provider, ok: c.ok, cached: c.cached, n: Number(c.n) })),
    settings: await aiSettings(),
  }
}

/** Etkin ve anahtarı olan en az bir sağlayıcı var mı (ekranda AI düğmelerini göstermek için; bekleme/limit çağrıda kontrol edilir). */
export async function aiAvailable(): Promise<boolean> {
  const any = await db.select({ id: schema.aiProviders.id }).from(schema.aiProviders).where(and(eq(schema.aiProviders.enabled, true), sql`${schema.aiProviders.keyLast4} is not null`)).limit(1)
  return any.length > 0
}
