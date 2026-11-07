// Özelleştirme Ö3b: şablon kütüphanesi kuralları (saf; testleri tests/cards-templates.test.ts).
export const CATEGORIES = [
  { id: 'sade', label: 'Sade' }, { id: 'renkli', label: 'Renkli' }, { id: 'kilo', label: 'Kilo verme' }, { id: 'kuvvet', label: 'Kuvvet' },
  { id: 'su', label: 'Su odaklı' }, { id: 'gece', label: 'Koyu ve gece' }, { id: 'erisilebilir', label: 'Erişilebilir' }, { id: 'diger', label: 'Diğer' },
] as const
export type Category = (typeof CATEGORIES)[number]['id']
export const isCategory = (s: unknown): s is Category => CATEGORIES.some((c) => c.id === s)
export type Sort = 'featured' | 'popular' | 'new' | 'saved' | 'mine'

/** Ad/açıklama/etiketleri temizler: boşluk, uzunluk, etiket biçimi (küçük harf, #'siz, en çok 5). */
export function normalizeMeta(m: { name: string; description?: string; category?: string; tags?: string[] }) {
  const name = m.name.replace(/\s+/g, ' ').trim().slice(0, 40)
  const description = (m.description ?? '').replace(/[ \t]+/g, ' ').trim().slice(0, 300)
  const tags = [...new Set((m.tags ?? []).map((t) => t.toLocaleLowerCase('tr-TR').replace(/^#/, '').replace(/[^\p{L}\d-]/gu, '').slice(0, 20)).filter(Boolean))].slice(0, 5)
  return { name, description, category: isCategory(m.category) ? m.category : 'diger' as Category, tags }
}

/**
 * Popülerlik puanı: kullanım beğeniden değerli, kaydetme ikisinin arası; yaşla yavaş söner (yeni şablonlar da öne çıkabilsin).
 * Saf olsun diye "şimdi" dışarıdan verilir.
 */
export function popularity(t: { likes: number; uses: number; saves: number; createdAt: Date }, now: Date): number {
  const ageDays = Math.max(0, (now.getTime() - t.createdAt.getTime()) / 86_400_000)
  return (t.uses * 3 + t.saves * 2 + t.likes) / Math.pow(ageDays + 2, 0.8)
}

/** Haftanın şablonu anahtarı: o haftanın pazartesi günü (YYYY-MM-DD). */
export function weekKey(day: string): string {
  const d = new Date(day + 'T12:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

/** Arama terimi: ILIKE için % ve _ kaçışlı, en çok 40 karakter; boşsa null. */
export function searchTerm(q: string | undefined | null): string | null {
  const t = (q ?? '').trim().slice(0, 40)
  return t ? `%${t.replace(/[\\%_]/g, (c) => '\\' + c)}%` : null
}
