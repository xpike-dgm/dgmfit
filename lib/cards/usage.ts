// Özelleştirme Ö4: kart kullanımından öneri ve rapor (saf; testleri tests/cards-usage.test.ts). Kullanım verisi yalnız kullanıcıya
// aittir (kendi kullanım haritası); şablonlarla paylaşılmaz.
import { cardDef, type ScreenId } from './registry.ts'
import type { LayoutItem } from './layout.ts'

export interface CardUsage { card: string; views: number; taps: number }
export interface Suggestion { id: string; screen: ScreenId; card: string; kind: 'up' | 'remove'; text: string; reason: string }

/** Ekranın kart kullanımına göre en çok iki öneri: sık dokunulan ama aşağıdaki kartı üste al; hiç dokunulmayan kartı kaldır. */
export function suggestLayout(screen: ScreenId, items: LayoutItem[], usage: CardUsage[], dismissed: string[] = [], minViews = 10): Suggestion[] {
  const u = new Map(usage.map((x) => [x.card, x]))
  const out: Suggestion[] = []
  const pos = (id: string) => items.findIndex((i) => i.id === id)
  // üste al: dokunma payı en yüksek kart 4. sıradan aşağıdaysa (başlık hariç)
  const ranked = items.filter((i) => !cardDef(i.id)?.locked).map((i) => ({ id: i.id, ...(u.get(i.id) ?? { views: 0, taps: 0 }) }))
    .filter((x) => x.views >= minViews && x.taps >= 3).sort((a, b) => b.taps - a.taps)
  const top = ranked[0]
  if (top && pos(top.id) > 3) {
    const id = `up:${top.id}`
    if (!dismissed.includes(id)) out.push({ id, screen, card: top.id, kind: 'up', text: `${cardDef(top.id)!.title} kartını üste alalım mı?`, reason: `En çok dokunduğun kart (${top.taps} kez) ama ${pos(top.id) + 1}. sırada.` })
  }
  // kaldır: çok görülmüş ama hiç dokunulmamış, kilitsiz ve koşulsuz (koşullu kart bazen boş durur) kart
  const idle = items.filter((i) => { const d = cardDef(i.id); const x = u.get(i.id); return d && !d.locked && !d.conditional && x && x.views >= minViews * 2 && x.taps === 0 })
    .sort((a, b) => (u.get(b.id)!.views - u.get(a.id)!.views))[0]
  if (idle) {
    const id = `remove:${idle.id}`
    if (!dismissed.includes(id)) out.push({ id, screen, card: idle.id, kind: 'remove', text: `${cardDef(idle.id)!.title} kartını kaldıralım mı?`, reason: `${u.get(idle.id)!.views} kez göründü, hiç dokunulmadı. Kaldırırsan çekmecede durur.` })
  }
  return out
}

/** Önerinin düzene uygulanmış hâli (üste al = sabit başlığın hemen altına; kaldır = listeden çıkar). */
export function applySuggestion(items: LayoutItem[], s: Pick<Suggestion, 'card' | 'kind'>): LayoutItem[] {
  if (s.kind === 'remove') return items.filter((i) => i.id !== s.card)
  const it = items.find((i) => i.id === s.card)
  if (!it) return items
  const head = items.filter((i) => cardDef(i.id)?.locked === 'top')
  return [...head, it, ...items.filter((i) => !head.includes(i) && i !== it)]
}

export interface DayCount { day: string; count: number }
/**
 * Kişisel deney raporu: düzen değişikliği gününden önceki ve sonraki `days` günün ortalama günlük kaydı. Değişiklik günü
 * sayılmaz. Her iki tarafta da en az `minDays` gün yoksa "henüz erken".
 */
export function experiment(changeDay: string, counts: DayCount[], days = 7, minDays = 3) {
  const shift = (d: string, n: number) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
  const by = new Map(counts.map((c) => [c.day, c.count]))
  const side = (from: number, to: number) => { const ds: string[] = []; for (let i = from; i <= to; i++) ds.push(shift(changeDay, i)); return ds }
  const beforeDays = side(-days, -1), afterDays = side(1, days)
  const avail = (ds: string[]) => ds.filter((d) => by.has(d))
  const avg = (ds: string[]) => (ds.length ? ds.reduce((a, d) => a + (by.get(d) ?? 0), 0) / ds.length : 0)
  const b = avail(beforeDays), a = avail(afterDays)
  if (b.length < minDays || a.length < minDays) return { ready: false as const, beforeDays: b.length, afterDays: a.length }
  const before = avg(b), after = avg(a)
  const change = before > 0 ? (after - before) / before : after > 0 ? 1 : 0
  return { ready: true as const, before: Math.round(before * 10) / 10, after: Math.round(after * 10) / 10, change: Math.round(change * 100), beforeDays: b.length, afterDays: a.length }
}

/** Kullanım haritası için dokunma oranı (görülme başına dokunma, 0–1). */
export const tapRate = (u: CardUsage) => (u.views ? Math.min(1, u.taps / u.views) : 0)
