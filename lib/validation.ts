// İstemci ve sunucuda ortak doğrulama kuralları.

export const USERNAME_RE = /^[a-zA-Z0-9_.]{3,20}$/
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function usernameError(u: string): string | null {
  if (u.length < 3) return 'En az 3 karakter olmalı'
  if (u.length > 20) return 'En fazla 20 karakter olabilir'
  if (!USERNAME_RE.test(u)) return 'Yalnızca harf, rakam, alt çizgi ve nokta'
  if (/^[.]|[.]$|\.\./.test(u)) return 'Nokta başta, sonda veya art arda olamaz'
  return null
}

export function emailError(e: string): string | null {
  if (!EMAIL_RE.test(e)) return 'Geçerli bir e-posta gir'
  const domain = e.split('@')[1]?.toLowerCase()
  if (domain && DISPOSABLE.has(domain)) return 'Tek kullanımlık e-posta adresleri kabul edilmiyor'
  return null
}

export interface PasswordCheck {
  ok: boolean
  score: 0 | 1 | 2 | 3 | 4
  issues: string[]
}

const COMMON = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1', 'qwerty123', 'qwertyui', '11111111', 'abc12345',
  'sifre123', 'şifre123', 'Password1', 'Qwerty123', 'galatasaray', 'fenerbahce', 'besiktas', 'iloveyou', 'Aa123456',
])

export function checkPassword(p: string): PasswordCheck {
  const issues: string[] = []
  if (p.length < 8) issues.push('En az 8 karakter')
  if (!/[a-zçğıöşü]/.test(p)) issues.push('Küçük harf')
  if (!/[A-ZÇĞİÖŞÜ]/.test(p)) issues.push('Büyük harf')
  if (!/[0-9]/.test(p)) issues.push('Rakam')
  const common = COMMON.has(p) || COMMON.has(p.toLowerCase())
  if (common) issues.push('Çok yaygın bir şifre')
  let score = 0
  if (p.length >= 8) score++
  if (p.length >= 12) score++
  if (/[a-zçğıöşü]/.test(p) && /[A-ZÇĞİÖŞÜ]/.test(p)) score++
  if (/[0-9]/.test(p) && /[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/.test(p)) score++
  if (common) score = 0
  return { ok: issues.length === 0, score: Math.min(4, score) as PasswordCheck['score'], issues }
}

const DOMAINS = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'yandex.com', 'live.com', 'msn.com', 'protonmail.com']

const DISPOSABLE = new Set(['mailinator.com', 'yopmail.com', '10minutemail.com', 'guerrillamail.com', 'tempmail.com', 'temp-mail.org', 'trashmail.com', 'getnada.com', 'sharklasers.com'])

function lev(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

/** "ali@gmial.com" → "ali@gmail.com" */
export function emailSuggestion(e: string): string | null {
  const [local, domain] = e.toLowerCase().split('@')
  if (!local || !domain || DOMAINS.includes(domain)) return null
  let best: string | null = null
  let bestD = 3
  for (const d of DOMAINS) {
    const dist = lev(domain, d)
    if (dist < bestD) { bestD = dist; best = d }
  }
  return best && bestD <= 2 ? `${local}@${best}` : null
}
