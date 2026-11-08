import { requireUser } from '@/lib/auth'
import { allScreenLayouts } from '@/lib/cards/design-data'
import { experimentReport, usageFor } from '@/lib/cards/usage-data'
import { tapRate } from '@/lib/cards/usage'
import { SCREENS, cardDef, type ScreenId } from '@/lib/cards/registry'
import { fmtNum } from '@/lib/calc'
import StudioHeader, { SectionLabel } from '@/components/cards/StudioHeader'
import { IconBox, Lead } from '@/components/cards/StudioUI'

export const metadata = { title: 'Kullanım haritam' }

/** Ö4: kendi kullanım haritam (yalnız sen görürsün) — son 14 günde hangi kartı ne kadar gördün/dokundun; düzen deneyi raporu. */
export default async function Page() {
  const u = await requireUser()
  const [layouts, usage, exp] = await Promise.all([allScreenLayouts(u.id), usageFor(u.id, 14), experimentReport(u.id).catch(() => null)])
  const by = new Map(usage.map((x) => [x.card, x]))
  const maxTaps = Math.max(1, ...usage.map((x) => x.taps))
  return (
    <div className="px-4 flex flex-col gap-4 pb-6" data-testid="usage">
      <StudioHeader back="/profil/ozellestirme/duzen" title="Kullanım haritam" />
      <Lead>Son 14 günde hangi kartı gördün, hangisine dokundun. Yalnız sen görürsün.</Lead>
      <section aria-label="Düzen deneyi" className="card rounded-[22px] p-4 flex gap-3" data-testid="experiment">
        <IconBox name="chart" mod="plan" />
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <b className="text-[15px] font-extrabold">Düzen deneyin</b>
        {!exp ? <p className="text-[13px] text-mute">Bir ekranın düzenini değiştirdiğinde, değişiklikten önceki ve sonraki 7 günde kaç kayıt (öğün, su, antrenman) girdiğini burada karşılaştırırız.</p>
          : !exp.ready ? <p className="text-[13px] text-mute">Son değişiklik: <b>{exp.note}</b> ({exp.changeDay}). Karşılaştırma için her iki tarafta en az 3 gün gerekiyor (şimdilik önce {exp.beforeDays}, sonra {exp.afterDays} gün).</p>
          : <p className="text-[14px]">Son değişiklik <b>{exp.note}</b> ({exp.changeDay}): önce günde ortalama <b className="num">{fmtNum(exp.before, 1)}</b>, sonra <b className="num">{fmtNum(exp.after, 1)}</b> kayıt — <b className={exp.change >= 0 ? 'text-acc' : 'text-danger'}>{exp.change >= 0 ? '+' : ''}{exp.change}%</b>.<span className="block text-[12px] text-mute mt-1">Başka şeyler de etkiler; bu bir ipucu, kesin sonuç değil.</span></p>}
        </div>
      </section>
      {(Object.keys(SCREENS) as ScreenId[]).map((s) => {
        const rows = layouts[s].items.flatMap((i) => [i.id, ...(i.stack ?? [])]).filter((id) => !cardDef(id)?.locked).map((id) => ({ id, card: id, views: by.get(id)?.views ?? 0, taps: by.get(id)?.taps ?? 0 }))
        if (!rows.some((r) => r.views)) return null
        return (
          <div key={s} className="flex flex-col gap-2">
            <span className="px-1"><SectionLabel>{SCREENS[s].title}</SectionLabel></span>
            <section aria-label={SCREENS[s].title} className="card rounded-[22px] px-4 py-2 flex flex-col gap-0.5" data-usage-screen={s}>
              {rows.map((r) => (
                <div key={r.id} className="flex flex-col gap-1.5 py-2" data-usage-card={r.id}>
                  <span className="flex items-baseline justify-between gap-3">
                    <b className="text-[13.5px] truncate">{cardDef(r.id)!.title}</b>
                    <span className="text-[12px] text-mute num shrink-0"><b className="text-ink" data-testid="usage-taps">{r.taps}</b> dokunma · {r.views} görülme{r.views >= 10 && !r.taps ? <span className="text-orange"> · az</span> : ''}</span>
                  </span>
                  <span className="h-2 rounded-full bg-surface-3 overflow-hidden" aria-hidden><span className="block h-full rounded-full bg-acc" style={{ width: `${Math.max(r.taps ? 4 : 0, Math.round((r.taps / maxTaps) * 100))}%` }} /></span>
                </div>
              ))}
              <p className="text-[12px] text-mute pt-1 pb-2 border-t border-line">En çok dokunulan: <b className="text-ink-2">{cardDef(rows.slice().sort((a, b) => tapRate(b) - tapRate(a))[0].id)!.title}</b></p>
            </section>
          </div>
        )
      })}
      {!usage.length ? <p className="card rounded-[22px] p-4 text-[13.5px] text-mute">Henüz kullanım kaydı yok. Ekranlarda gezindikçe burası dolar.</p> : null}
    </div>
  )
}
