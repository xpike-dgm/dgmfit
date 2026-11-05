import { requireUser } from '@/lib/auth'
import { listMeasurements, MEASURES, MEASURE_LABEL } from '@/lib/fitness-stats'
import { listProgressPhotos, mediaEnabled } from '@/lib/media'
import { dayString, shortDate } from '@/lib/time'
import { fmtNum } from '@/lib/calc'
import { Eyebrow, TopBar } from '@/components/ui'
import { MeasureForm, DeleteMeasure, Photos } from './MeasureClient'

export const metadata = { title: 'Ölçüler ve fotoğraflar · DgFit' }

export default async function MeasurePage() {
  const u = await requireUser()
  const [rows, photos] = await Promise.all([listMeasurements(u.id), listProgressPhotos(u.id)])
  const first = rows.at(-1), last = rows[0]
  const used = MEASURES.filter((k) => rows.some((r) => r[k] !== null))
  return (
    <div className="flex flex-col gap-3 px-4">
      <TopBar back="/fitness" title="Ölçüler ve fotoğraflar" />
      <MeasureForm today={dayString()} />
      {rows.length ? (
        <section className="card p-5 flex flex-col gap-2" aria-label="Ölçü geçmişi" data-testid="measures">
          <Eyebrow>Ölçü geçmişi</Eyebrow>
          {first && last && first !== last ? (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {used.map((k) => {
                const a = first[k], b = last[k]
                if (a === null || b === null) return null
                const d = Math.round((b - a) * 10) / 10
                return <span key={k} className="text-[12px] px-2.5 h-7 rounded-full bg-surface-2 flex items-center">{MEASURE_LABEL[k]} <b className="num ml-1">{d > 0 ? '+' : d < 0 ? '−' : ''}{fmtNum(Math.abs(d), 1)}</b></span>
              })}
              <span className="text-[11px] text-mute self-center">ilk kayıttan bu yana</span>
            </div>
          ) : null}
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-[13px] num">
              <thead><tr className="text-mute text-left"><th className="py-1 pr-3 font-semibold">Tarih</th>{used.map((k) => <th key={k} className="py-1 pr-3 font-semibold">{MEASURE_LABEL[k]}</th>)}<th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="py-2 pr-3 whitespace-nowrap">{shortDate(r.day)}</td>
                    {used.map((k) => <td key={k} className="py-2 pr-3">{r[k] === null ? '–' : fmtNum(r[k]!, 1)}</td>)}
                    <td><DeleteMeasure id={r.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <span className="text-[11px] text-mute">cm; yağ oranı %.</span>
        </section>
      ) : null}
      <Photos enabled={mediaEnabled()} today={dayString()} photos={photos.map((p) => ({ id: p.id, day: p.day, pose: p.pose }))} />
    </div>
  )
}
