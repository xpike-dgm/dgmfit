// Faz 5h-5: seans MSS (merkezi sinir sistemi) yükü — kendi algoritmamız ve metinlerimiz (saf; tests/cns.test.ts).
// Girdi: hareketin MSS puanı (lisanslı hareket verisi, 1–10; yoksa hareket türünden tahmin) × çalışma seti × efor (RiR / set tipi).

export interface CnsExercise { cns: number | null; mechanic: string | null; equipment: string; kind: string }
export interface CnsSetIn extends CnsExercise { exerciseId: number; name: string; type: string; rir: number | null }

/** Hareketin MSS puanı; lisanslı puan yoksa tahmin (çok eklemli serbest ağırlık yüksek, izolasyon/kardiyo düşük). */
export function exerciseCns(e: CnsExercise): { score: number; estimated: boolean } {
  if (e.cns != null && e.cns > 0) return { score: Math.min(10, Math.max(1, e.cns)), estimated: false }
  if (e.kind === 'cardio' || e.kind === 'distance_time' || e.kind === 'time') return { score: 2, estimated: true }
  if (e.mechanic === 'isolation') return { score: 3, estimated: true }
  if (e.mechanic === 'compound') return { score: e.equipment === 'barbell' ? 7 : e.equipment === 'body only' ? 4 : 5, estimated: true }
  return { score: 4, estimated: true }
}

/** Efor çarpanı: tükenişe yakın setler daha yorucu. */
export function effortFactor(type: string, rir: number | null): number {
  if (type === 'failure' || type === 'amrap') return 1.2
  const t = type === 'drop' || type === 'restpause' || type === 'myorep' ? 1.15 : 1
  if (rir == null) return t
  const r = rir <= 0.5 ? 1.2 : rir <= 1.5 ? 1.1 : rir <= 2.5 ? 1 : rir <= 3.5 ? 0.9 : 0.8
  return t > 1 ? Math.max(t, r) : r
}

/** Tek çalışma setinin yükü (ısınma 0). */
export const setLoad = (score: number, type: string, rir: number | null) => (type === 'warmup' ? 0 : (score / 10) * effortFactor(type, rir))

export const CNS_LEVELS = [
  { label: 'Çok hafif', text: 'Merkezi sinir sistemine neredeyse yük binmedi. Toparlanması kolay; gelişim hedefin varsa bu seans hafif kalmış olabilir.' },
  { label: 'Hafif', text: 'Hafif bir merkezi yük. Sonraki antrenmanlarında bu seans yüzünden performans düşüşü beklenmez.' },
  { label: 'Dengeli', text: 'Dengeli bir yük: iyi bir antrenman için yeterli, toparlanması zor değil. Programın böyle seanslardan oluşması sürdürülebilir.' },
  { label: 'Yüksek', text: 'Yüksek merkezi yük. Seansın sonundaki hareketlerde performans düşmüş olabilir; sonraki gün ağır bir seans yerine hafif bir gün ya da dinlenme düşün.' },
  { label: 'Çok yüksek', text: 'Çok yüksek merkezi yük. Toparlanmaya en az 48 saat ayır; bu yoğunluk sık tekrarlanırsa ağır, çok eklemli hareketlerdeki set sayısını ya da tükenişe yakın setleri azalt.' },
] as const
/** Yük → kademe (1–5). Ölçek: ortalama MSS puanı 6 olan ~18 set ≈ 10,8 → 3 (dengeli). */
export const CNS_BOUNDS = [3, 7, 12, 17] as const
export const cnsLevel = (load: number) => 1 + CNS_BOUNDS.filter((b) => load >= b).length

export function sessionCns(sets: CnsSetIn[]) {
  const by = new Map<number, { exerciseId: number; name: string; load: number; sets: number; score: number; estimated: boolean }>()
  let load = 0, estimated = false
  for (const s of sets) {
    if (s.type === 'warmup') continue
    const c = exerciseCns(s)
    const l = setLoad(c.score, s.type, s.rir)
    load += l; estimated ||= c.estimated
    const e = by.get(s.exerciseId) ?? { exerciseId: s.exerciseId, name: s.name, load: 0, sets: 0, score: c.score, estimated: c.estimated }
    e.load += l; e.sets += 1; by.set(s.exerciseId, e)
  }
  const r = (v: number) => Math.round(v * 10) / 10
  const level = cnsLevel(load)
  const top = [...by.values()].sort((a, b) => b.load - a.load).map((e) => ({ ...e, load: r(e.load), share: load ? Math.round((e.load / load) * 100) : 0 }))
  return { load: r(load), level, label: CNS_LEVELS[level - 1].label, text: CNS_LEVELS[level - 1].text, estimated, exercises: top }
}

/** Haftalık özet: toplam yük ve seans başına ortalama kademe; yüksek+ seans sayısı. */
export function weeklyCns(sessions: { load: number }[]) {
  const total = sessions.reduce((a, s) => a + s.load, 0)
  const avg = sessions.length ? total / sessions.length : 0
  const hard = sessions.filter((s) => cnsLevel(s.load) >= 4).length
  const note = !sessions.length ? 'Bu hafta kayıtlı antrenman yok.'
    : hard >= 3 ? `Bu hafta ${hard} yüksek yüklü seans var; toparlanma için araya hafif günler koy.`
      : hard >= 1 ? `Bu hafta ${hard} yüksek yüklü seans var; sonraki günlerde uykuya ve beslenmeye dikkat.`
        : avg < 3 ? 'Seanslar hafif; gelişim yavaşsa çok eklemli hareketlere ya da set sayısına ekleme yapabilirsin.'
          : 'Haftalık yük dengeli görünüyor.'
  return { total: Math.round(total * 10) / 10, avgLevel: sessions.length ? cnsLevel(avg) : 0, hard, note }
}
