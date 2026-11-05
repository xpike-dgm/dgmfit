import 'server-only'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Lisanslı içerik paketi (Ağırsağlam; DgFit'e özel yazılı izin — memory/DECISIONS.md). Paket depoda değil,
 * sunucuda DGFIT_LICENSED_DIR altında. Dosyalar yalnızca oturumu olan onaylı kullanıcılara `/api/lisansli/...` ile verilir.
 */
export const LICENSED_DIR = process.env.DGFIT_LICENSED_DIR ?? ''
export const AG_SOURCE = { label: 'Ağırsağlam', url: 'https://www.agirsaglam.com' }
export const LICENSED_KINDS = ['videos', 'anatomy', 'plates'] as const

/** Güvenli dosya yolu: yalnızca izinli alt klasör + düz dosya adı. */
export function licensedPath(kind: string, file: string): string | null {
  if (!LICENSED_DIR || !(LICENSED_KINDS as readonly string[]).includes(kind) || !/^[A-Za-z0-9_.-]{1,120}$/.test(file) || file.startsWith('.')) return null
  const p = path.join(LICENSED_DIR, kind, file)
  return p.startsWith(path.join(LICENSED_DIR, kind) + path.sep) && fs.existsSync(p) ? p : null
}
export const licensedUrl = (kind: (typeof LICENSED_KINDS)[number], file: string | null | undefined) => (file ? `/api/lisansli/${kind}/${encodeURIComponent(file)}` : null)
export const hasLicensedFile = (kind: (typeof LICENSED_KINDS)[number], file: string | null | undefined) => !!(file && licensedPath(kind, file))

const textCache = new Map<string, unknown>()
/** Paketteki ekran metni (ör. texts/tam-ekran-metinleri.tr.json); yoksa null. */
export function licensedText<T = Record<string, unknown>>(name: string): T | null {
  if (!LICENSED_DIR || !/^[a-z0-9-]+\.(tr|en)$/.test(name)) return null
  if (!textCache.has(name)) {
    try { textCache.set(name, JSON.parse(fs.readFileSync(path.join(LICENSED_DIR, 'texts', name + '.json'), 'utf8'))) } catch { textCache.set(name, null) }
  }
  return textCache.get(name) as T | null
}

/** Hareket özelliklerinin kısa adı (DgFit) ve paketteki uzun açıklaması (Ağırsağlam metni). */
export const FEATURE_LABEL: Record<string, string> = { unilateral: 'Tek taraflı', overload: 'Yüklenebilir', longMuscle: 'Uzun kas boyu', balance: 'Denge', techniquel: 'Teknik', power: 'Güç', stability: 'Stabilite' }
const FEATURE_TEXT_KEY: Record<string, string> = { unilateral: 'descriptionUnilateral', overload: 'descriptionOverload', longMuscle: 'descriptionLongMuscle', balance: 'descriptionBalance', techniquel: 'descriptionTechnique', power: 'descriptionPower', stability: 'descriptionStability' }
export function featureDescription(f: string): string | null {
  const t = licensedText<{ product?: { extensions?: { special_feature?: Record<string, string> } } }>('tam-ekran-metinleri.tr')
  return t?.product?.extensions?.special_feature?.[FEATURE_TEXT_KEY[f] ?? ''] ?? null
}

/** Ağırsağlam kas anahtarlarının Türkçe adları (anatomi haritası ve kas etkisi listesi). */
export const AG_MUSCLE_TR: Record<string, string> = {
  abs: 'Karın', obliques: 'Yan karın', biceps: 'Biceps', forearms: 'Ön kol', tricepsLong: 'Triceps (uzun baş)', tricepsLateral: 'Triceps (dış baş)',
  anteriorDeltoid: 'Ön omuz', middleDeltoid: 'Orta omuz', posteriorDeltoid: 'Arka omuz', pectoralisClavicular: 'Üst göğüs', pectoralisSternal: 'Orta-alt göğüs',
  lats: 'Kanat (lat)', upperTraps: 'Üst trapez', lowerTraps: 'Orta-alt trapez', rotatorCuff: 'Rotator manşet', spinalErectors: 'Bel (omurga dikleştirici)',
  glutes: 'Kalça', quads: 'Ön bacak', hams: 'Arka bacak', adductors: 'İç bacak', calves: 'Baldır', hipFlexors: 'Kalça bükücü', neckFlexors: 'Boyun',
}
