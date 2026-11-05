// Günlük proaktif içgörü adayları — saf, testli (tests/coach.test.ts).
// Kural motoru gerçeği ve sayıları bulur; dil modeli yalnızca kişiliğe göre ifade eder (spesifikasyon 10: günde en fazla 1).
import { dow, isLogged, WEEKDAY, type DayFacts } from './weekly.ts'
import { kcalAdherence } from './fit.ts'

export interface InsightFact {
  key: string // konu anahtarı (son 7 günde tekrarlanmaz)
  tone: 'good' | 'warn' | 'info'
  text: string // kural metni (AI yoksa gösterilir)
  numbers: number[] // metinde geçmesine izin verilen sayılar
  ask: string // "Koça sor" için hazır soru
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)

/**
 * `days`: bugün hariç son 14 gün (eskiden yeniye). `extra`: başka motorlardan hazır adaylar (ör. su analizi).
 * Öncelik sırasıyla adaylar döner; çağıran son 7 günde kullanılmış anahtarları eler ve ilkini seçer.
 */
export function insightCandidates(days: DayFacts[], goal: 'lose' | 'gain' | 'recomp', weightChange14: number | null, extra: InsightFact[] = []): InsightFact[] {
  const out: InsightFact[] = []
  const last7 = days.slice(-7), logged14 = days.filter(isLogged), logged7 = last7.filter(isLogged)

  // 1) Kayıt boşluğu: son 2 gün hiç kayıt yok (ama daha önce kayıt vardı)
  if (days.length >= 3 && days.slice(-2).every((d) => d.items === 0) && days.slice(0, -2).some((d) => d.items > 0))
    out.push({ key: 'logging_gap', tone: 'info', text: 'Son 2 gündür öğün kaydı yok. Kısa bir kayıt bile Fit dengelemenin doğru çalışmasını sağlar; bugün bir öğünle yeniden başla.', numbers: [2], ask: 'Kayıt tutmayı nasıl kolaylaştırabilirim?' })

  // 2) Hafta sonu fazlası (son 14 gün)
  const we = logged14.filter((d) => [0, 6].includes(dow(d.day))), wd = logged14.filter((d) => ![0, 6].includes(dow(d.day)))
  if (we.length >= 2 && wd.length >= 4) {
    const diff = Math.round(avg(we.map((d) => d.eaten)) - avg(wd.map((d) => d.eaten)))
    if (diff >= 300) {
      const worst = [...we].sort((a, b) => b.eaten - b.target - (a.eaten - a.target))[0]
      out.push({ key: 'weekend_surplus', tone: 'warn', text: `Hafta sonları hafta içine göre ortalama ${diff} kcal fazla alıyorsun; en riskli gün ${WEEKDAY[dow(worst.day)]}. Önceden plan yapmak ya da kalori bankası kullanmak işe yarar.`, numbers: [diff], ask: 'Hafta sonu fazlasını nasıl azaltırım?' })
    }
  }

  // 3) Protein düşük (son 7 gün)
  const p7 = logged7.filter((d) => d.proteinTarget > 0)
  if (p7.length >= 4) {
    const pct = Math.round(avg(p7.map((d) => Math.min(1.5, d.protein / d.proteinTarget))) * 100)
    if (pct < 80) out.push({ key: 'protein_low', tone: 'warn', text: `Son ${p7.length} kayıtlı günde protein hedefinin ortalama %${pct}'ine ulaştın. Kahvaltıya yumurta, yoğurt ya da peynir eklemek kolay bir başlangıç.`, numbers: [p7.length, pct], ask: 'Proteinimi nasıl artırırım?' })
  }

  // 4) Kilo trendi hedefin tersine (14 gün)
  if (goal !== 'recomp' && weightChange14 !== null && ((goal === 'lose' && weightChange14 >= 0.3) || (goal === 'gain' && weightChange14 <= -0.3)))
    out.push({ key: 'trend_reverse', tone: 'info', text: `Trend kilon son 14 günde ${weightChange14 > 0 ? '+' : ''}${String(weightChange14).replace('.', ',')} kg değişti, hedefinin tersine. Su ve tuz dalgalanması olabilir; sürerse Fit check-in hedefini günceller.`, numbers: [14, weightChange14], ask: 'Neden kilo vermiyorum?' })

  // 5) Su hedefi az tutturuldu (son 7 gün)
  const w7 = last7.filter((d) => d.waterMl > 0)
  if (w7.length >= 4) {
    const hit = last7.filter((d) => d.waterGoal > 0 && d.waterMl >= d.waterGoal).length
    if (hit <= 2) out.push({ key: 'water_low', tone: 'warn', text: `Son 7 günün ${hit} gününde su hedefini tamamladın. Gün ortasında bir şişe doldurmak farkı kapatır.`, numbers: [hit], ask: 'Su hedefimi neden tutturamıyorum?' })
  }

  out.push(...extra)

  // 6) Olumlu pekiştirme
  const good = logged7.filter((d) => kcalAdherence(d.eaten, d.target) >= 0.9).length
  if (good >= 5) out.push({ key: 'on_track', tone: 'good', text: `Son 7 günün ${good} gününde kalori hedefine çok yakın kaldın. Bu tutarlılık sonucu getiren şey.`, numbers: [good], ask: 'Bu tempoyla hedefe ne zaman ulaşırım?' })
  const tr = last7.filter((d) => d.workouts > 0 || d.cardioMin >= 20).length
  if (tr >= 3 && tr <= 6) out.push({ key: 'training_good', tone: 'good', text: `Bu hafta ${tr} gün antrenman yaptın. Düzenli devam etmek ilerlemenin anahtarı.`, numbers: [tr], ask: 'Antrenmanımı nasıl geliştirebilirim?' })
  if (!out.length) out.push({ key: 'start', tone: 'info', text: 'Birkaç gün düzenli kayıt tuttuğunda burada sana özel içgörüler göreceksin.', numbers: [], ask: 'DgFit\'i en iyi nasıl kullanırım?' })
  return out
}

/** Son 7 günde kullanılmamış ilk aday; hepsi kullanıldıysa ilk aday. */
export function pickInsight(cands: InsightFact[], usedKeys: string[]): InsightFact {
  return cands.find((c) => !usedKeys.includes(c.key)) ?? cands[0]
}
