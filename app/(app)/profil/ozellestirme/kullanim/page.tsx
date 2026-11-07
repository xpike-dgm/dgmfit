import { requireUser } from '@/lib/auth'
import { allScreenLayouts } from '@/lib/cards/design-data'
import { experimentReport, usageFor } from '@/lib/cards/usage-data'
import { tapRate } from '@/lib/cards/usage'
import { SCREENS, cardDef, type ScreenId } from '@/lib/cards/registry'
import { fmtNum } from '@/lib/calc'
import { TopBar } from '@/components/ui'

export const metadata = { title: 'Kullanım haritam' }

/** Ö4: kendi kullanım haritam (yalnız sen görürsün) — son 14 günde hangi kartı ne kadar gördün/dokundun; düzen deneyi raporu. */
export default async function Page() {
  const u = await requireUser()
  const [layouts, usage, exp] = await Promise.all([allScreenLayouts(u.id), usageFor(u.id, 14), experimentReport(u.id).catch(() => null)])
  const by = new Map(usage.map((x) => [x.card, x]))
  const maxTaps = Math.max(1, ...usage.map((x) => x.taps))
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="usage">
      <TopBar back="/profil/ozellestirme" title="Kullanım haritam" sub="Son 14 gün · yalnız sen görürsün" />
      <section aria-label="Düzen deneyi" className="card p-4 flex flex-col gap-1.5" data-testid="experiment">
        <b className="text-[15px]">Düzen deneyin</b>
        {!exp ? <p className="text-[13px] text-mute">Bir ekranın düzenini değiştirdiğinde, değişiklikten önceki ve sonraki 7 günde kaç kayıt (öğün, su, antrenman) girdiğini burada karşılaştırırız.</p>
          : !exp.ready ? <p className="text-[13px] text-mute">Son değişiklik: <b>{exp.note}</b> ({exp.changeDay}). Karşılaştırma için her iki tarafta en az 3 gün gerekiyor (şimdilik önce {exp.beforeDays}, sonra {exp.afterDays} gün).</p>
          : <p className="text-[14px]">Son değişiklik <b>{exp.note}</b> ({exp.changeDay}): önce günde ortalama <b className="num">{fmtNum(exp.before, 1)}</b>, sonra <b className="num">{fmtNum(exp.after, 1)}</b> kayıt — <b className={exp.change >= 0 ? 'text-acc' : 'text-danger'}>{exp.change >= 0 ? '+' : ''}{exp.change}%</b>.<span className="block text-[12px] text-mute mt-1">Başka şeyler de etkiler; bu bir ipucu, kesin sonuç değil.</span></p>}
      </section>
      {(Object.keys(SCREENS) as ScreenId[]).map((s) => {
        const rows = layouts[s].items.flatMap((i) => [i.id, ...(i.stack ?? [])]).filter((id) => !cardDef(id)?.locked).map((id) => ({ id, card: id, views: by.get(id)?.views ?? 0, taps: by.get(id)?.taps ?? 0 }))
        if (!rows.some((r) => r.views)) return null
        return (
          <section key={s} aria-label={SCREENS[s].title} className="card px-4 py-1 flex flex-col" data-usage-screen={s}>
            <h2 className="text-[15px] font-extrabold pt-3 pb-1">{SCREENS[s].title}</h2>
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 min-h-11 border-t border-line first:border-0" data-usage-card={r.id}>
                <span className="w-28 shrink-0 text-[13px] font-bold truncate">{cardDef(r.id)!.title}</span>
                <span className="flex-1 h-2.5 rounded-full bg-surface-3 overflow-hidden" aria-hidden><span className="block h-full rounded-full bg-acc" style={{ width: `${Math.round((r.taps / maxTaps) * 100)}%` }} /></span>
                <span className="w-24 shrink-0 text-right text-[11.5px] text-mute num"><span data-testid="usage-taps">{r.taps}</span> dokunma · {r.views} görülme{r.views >= 10 && !r.taps ? ' · az' : ''}</span>
              </div>
            ))}
            <p className="text-[11.5px] text-mute pb-2">Dokunma oranı en yüksek: {cardDef(rows.slice().sort((a, b) => tapRate(b) - tapRate(a))[0].id)!.title}</p>
          </section>
        )
      })}
      {!usage.length ? <p className="card p-4 text-[13.5px] text-mute">Henüz kullanım kaydı yok. Ekranlarda gezindikçe burası dolar.</p> : null}
    </div>
  )
}
