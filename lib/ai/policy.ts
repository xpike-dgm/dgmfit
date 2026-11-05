// Sağlayıcı seçimi ve hata sınıflandırması — saf. Testler: tests/ai.test.ts
export type ProviderId = 'claude' | 'openai'
export interface ProviderState {
  id: ProviderId; enabled: boolean; priority: number; hasKey: boolean
  dailyTokenLimit: number; monthlyTokenLimit: number; usedToday: number; usedMonth: number; cooldownUntil: Date | null
}

/** Kullanılabilir sağlayıcılar, öncelik sırasıyla. Neden kullanılamadığı da döner (yönetici ekranı için). */
export function pickProviders(list: ProviderState[], now: Date): { usable: ProviderId[]; skipped: { id: ProviderId; reason: string }[] } {
  const usable: ProviderId[] = [], skipped: { id: ProviderId; reason: string }[] = []
  for (const p of [...list].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))) {
    if (!p.enabled) skipped.push({ id: p.id, reason: 'kapalı' })
    else if (!p.hasKey) skipped.push({ id: p.id, reason: 'anahtar yok' })
    else if (p.cooldownUntil && p.cooldownUntil > now) skipped.push({ id: p.id, reason: 'bekleme süresinde' })
    else if (p.dailyTokenLimit > 0 && p.usedToday >= p.dailyTokenLimit) skipped.push({ id: p.id, reason: 'günlük limit doldu' })
    else if (p.monthlyTokenLimit > 0 && p.usedMonth >= p.monthlyTokenLimit) skipped.push({ id: p.id, reason: 'aylık limit doldu' })
    else usable.push(p.id)
  }
  return { usable, skipped }
}

export type ErrorKind = 'quota' | 'rate' | 'auth' | 'overloaded' | 'refusal' | 'bad_output' | 'bad_request' | 'network'

/**
 * HTTP durum + sağlayıcı hata kodu → tür ve bekleme süresi. Claude: 429 rate_limit_error, 529 overloaded_error, 401/403.
 * OpenAI (resmi belge): 429 kodları credit_balance_exhausted / *_spend_limit_exceeded / *_usage_limit_exceeded (kota) ve slow_down; 503 server_is_overloaded.
 * Kota türleri yeniden denemekle düzelmez → sağlayıcı bir süre atlanır.
 */
export function classifyError(status: number | null, code: string | null): { kind: ErrorKind; cooldownMs: number; failover: boolean } {
  const c = (code ?? '').toLowerCase()
  if (status === 429 && /credit|balance|spend_limit|usage_limit|insufficient_quota|quota/.test(c)) return { kind: 'quota', cooldownMs: 6 * 3600_000, failover: true }
  if (status === 429) return { kind: 'rate', cooldownMs: 60_000, failover: true }
  if (status === 401 || status === 403) return { kind: 'auth', cooldownMs: 30 * 60_000, failover: true }
  if (status !== null && (status >= 500 || status === 529)) return { kind: 'overloaded', cooldownMs: 30_000, failover: true }
  if (status === 400 && /credit|balance|billing/.test(c)) return { kind: 'quota', cooldownMs: 6 * 3600_000, failover: true }
  if (status === 400) return { kind: 'bad_request', cooldownMs: 0, failover: true }
  if (status === null) return { kind: 'network', cooldownMs: 15_000, failover: true }
  return { kind: 'bad_request', cooldownMs: 0, failover: true }
}

/** Kullanıcı başına günlük adil kullanım (uygulama ücretsiz). Önbellekten gelenler sayılmaz. */
export const DEFAULT_USER_DAILY = 25
