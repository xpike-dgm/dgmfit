import 'server-only'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Lisanslı içerik paketi (Ağırsağlam; DgFit'e özel yazılı izin — memory/DECISIONS.md). Paket depoda değil,
 * sunucuda DGFIT_LICENSED_DIR altında. Dosyalar yalnızca oturumu olan onaylı kullanıcılara `/api/lisansli/...` ile verilir.
 */
export const LICENSED_DIR = process.env.DGFIT_LICENSED_DIR ?? ''
export const AG_SOURCE = { label: 'Ağırsağlam', url: 'https://www.agirsaglam.com' }
export const LICENSED_KINDS = ['videos', 'anatomy', 'plates', 'thumbs'] as const

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

type Lic = { video: { right: string | null; wrong: string | null } } | null | undefined
/** Lisanslı hareketin küçük resmi (videodan üretilmiş kare) ve doğru yapılış videosu; dosya yoksa null. */
export function exerciseMedia(l: Lic): { thumb: string | null; video: string | null } {
  const v = l?.video.right ?? null
  const t = v ? v.replace(/\.mp4$/, '.jpg') : null
  return { thumb: t && hasLicensedFile('thumbs', t) ? licensedUrl('thumbs', t) : null, video: v && hasLicensedFile('videos', v) ? licensedUrl('videos', v) : null }
}

/** RiR kaydırıcısı açıklamaları (0, 0,5 … 4, 4+ = 10 kademe): paket metni, yoksa DgFit'in kısa metni. */
const RIR_FALLBACK = ['Tükeniş: bir tekrar daha çıkmaz.', 'Belki bir tekrar daha.', '1 tekrar daha vardı.', '1–2 tekrar daha vardı.', '2 tekrar daha vardı.', '2–3 tekrar daha vardı.', '3 tekrar daha vardı.', '3–4 tekrar daha vardı.', '4 tekrar daha vardı.', 'Çok hafif: tükenişten uzak.']
export function rirTexts(): { steps: string[]; info: string } {
  const r = licensedText<{ premium?: { exercise_logs?: { rir?: Record<string, string> } } }>('tam-ekran-metinleri.tr')?.premium?.exercise_logs?.rir
  return { steps: RIR_FALLBACK.map((f, i) => r?.[String(i)] ?? f), info: r?.info ?? 'RIR: setin sonunda kaç tekrar daha yapabilirdin. 0 = tükendim, 4+ = çok hafifti.' }
}
