'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Sheet from '@/components/Sheet'
import { btn, Ring } from '@/components/ui'
import { Back, Bottle, Chart, Check, Clock, Cup, Drop, Flame, Gear, Glass, Merge, Mic, Next, Thermos, Trash, Trend } from '@/components/icons'
import { parseWaterSpeech } from '@/lib/water-speech'
import { fmtNum } from '@/lib/calc'
import { DRINKS, distributionScore, effectiveMl, fmtHm, hourlyBuckets, idealAt, isLikelyDuplicate, type DrinkId } from '@/lib/water'
import type { WaterLogView, WaterScreen as Data, ContainerView } from '@/lib/water-data'
import { addWater, deleteWater, mergeWater, undoWater, updateWater } from './actions'

type Toast = { kind: 'undo'; id: number; ml: number } | { kind: 'info'; text: string } | null
type Pending = { ml: number; source: 'button' | 'sip' | 'container' | 'fill' | 'finish' | 'custom' | 'backdate' | 'voice'; containerId?: string | null; fill?: number; at?: string; drink?: DrinkId }

const KIND_ICON: Record<string, typeof Glass> = { glass: Glass, bottle: Bottle, thermos: Thermos, cup: Cup }
const SOURCE_LABEL: Record<string, string> = {
  button: 'Tek dokunuş', sip: 'Yudum', container: 'Kap', fill: 'Doluluk seçimi', finish: '“Bitirdim”', custom: 'Özel miktar',
  backdate: 'Sonradan eklendi', meal: 'Yemekten', voice: 'Sesli kayıt', notification: 'Bildirim yanıtı',
}

function isoAt(day: string, hm: string) { return new Date(`${day}T${hm}:00+03:00`).toISOString() }
function hmFromMin(min: number) { const h = Math.floor(min / 60) % 24, m = min % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` }

export default function WaterScreen({ data }: { data: Data }) {
  const router = useRouter()
  const [logs, setLogs] = useState<WaterLogView[]>(data.logs)
  const [drink, setDrink] = useState<DrinkId>('water')
  const [toast, setToast] = useState<Toast>(null)
  const [dup, setDup] = useState<Pending | null>(null)
  const [sheet, setSheet] = useState<null | 'custom' | 'sip' | 'voice' | { container: ContainerView } | { edit: WaterLogView }>(null)
  const [mergeMode, setMergeMode] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [pop, setPop] = useState(0)
  const [pastTime, setPastTime] = useState(data.isToday ? hmFromMin(data.nowMin) : '12:00')
  const [, start] = useTransition()
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setLogs(data.logs) }, [data.logs])

  const total = useMemo(() => logs.reduce((a, l) => a + l.effectiveMl, 0), [logs])
  const dayLogs = useMemo(() => logs.map((l) => ({ at: l.at, ml: l.effectiveMl })), [logs])
  const hourly = useMemo(() => hourlyBuckets(dayLogs), [dayLogs])
  const distribution = useMemo(() => distributionScore(dayLogs, data.wake, data.sleep, data.isToday ? data.nowMin : undefined), [dayLogs, data])
  const ideal = data.isToday ? idealAt(data.goal, data.wake, data.sleep, data.nowMin) : data.goal
  const frac = data.goal ? total / data.goal : 0
  const ahead = total - ideal
  const left = Math.max(0, data.goal - total)

  const showToast = (t: Toast, ms = 5000) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(t)
    toastTimer.current = setTimeout(() => setToast(null), ms)
  }

  const add = (p: Pending, force = false) => {
    const tempId = -Date.now()
    const atIso = p.at ?? (data.isToday ? new Date().toISOString() : isoAt(data.day, pastTime))
    // Anında çift kayıt kontrolü (henüz sunucuya ulaşmamış kayıtlar dahil); sunucu da ayrıca kontrol eder
    if (!force && isLikelyDuplicate(p.ml, Date.parse(atIso), logs.map((l) => ({ ml: l.ml, atMs: Date.parse(l.atIso) })))) { setDup(p); return }
    const cont = p.containerId ? data.containers.find((c) => c.id === p.containerId) : null
    const dr = p.drink ?? drink
    const temp: WaterLogView = { id: tempId, atIso, at: minuteFromIso(atIso), ml: p.ml, effectiveMl: effectiveMl(p.ml, dr), drink: dr, containerId: p.containerId ?? null, containerName: cont?.name ?? null, source: p.source, edited: false }
    setLogs((x) => [...x, temp].sort((a, b) => a.at - b.at))
    setPop((n) => n + 1)
    if (data.feedback && 'vibrate' in navigator) navigator.vibrate?.(12)
    start(async () => {
      const r = await addWater({ ml: p.ml, drink: dr, source: p.source, containerId: p.containerId ?? null, fill: p.fill, at: p.at ?? (data.isToday ? undefined : atIso), force })
      if (!r.ok) {
        setLogs((x) => x.filter((l) => l.id !== tempId))
        if ('duplicate' in r) setDup(p)
        else showToast({ kind: 'info', text: r.error })
        return
      }
      setLogs((x) => x.map((l) => (l.id === tempId ? r.log : l)).sort((a, b) => a.at - b.at))
      showToast(r.warning ? { kind: 'info', text: r.warning } : { kind: 'undo', id: r.log.id, ml: r.log.ml }, r.warning ? 7000 : 5000)
      router.refresh()
    })
  }

  const undo = (id: number) => {
    setLogs((x) => x.filter((l) => l.id !== id))
    setToast(null)
    start(async () => { await undoWater(id); router.refresh() })
  }

  const doMerge = () => {
    if (selected.length < 2) return
    start(async () => {
      const r = await mergeWater(selected)
      if (!r.ok) { showToast({ kind: 'info', text: r.error }); return }
      setMergeMode(false); setSelected([]); router.refresh()
      showToast({ kind: 'info', text: `${selected.length} kayıt birleştirildi` }, 3000)
    })
  }

  const prev = shiftDay(data.day, -1)
  const next = shiftDay(data.day, 1)
  const maxPast = shiftDay(todayStr(), -365)

  return (
    <div className="px-4 pt-4 flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <Link href="/" aria-label="Bugün ekranına dön" className={btn.icon}><Back size={20} /></Link>
        <div className="flex items-center gap-1">
          {data.day > maxPast ? <Link href={`/su?gun=${prev}`} aria-label="Önceki gün" className="w-11 h-11 flex items-center justify-center text-mute"><Back size={18} /></Link> : <span className="w-11" />}
          <div className="flex flex-col items-center min-w-[120px]">
            <span className="text-lg font-extrabold">{data.isToday ? 'Su' : dayLabel(data.day)}</span>
            <span className="text-[13px] text-mute flex items-center gap-1">
              <Flame size={13} className="text-orange" /> Seri {data.streak.current} gün · {data.streak.freezesLeft} dondurma
              {data.isToday && data.streak.current >= 2 ? <Link href="/sosyal/yeni?tur=streak" className="text-lime font-bold ml-1">Paylaş</Link> : null}
            </span>
          </div>
          {!data.isToday ? <Link href={next >= todayStr() ? '/su' : `/su?gun=${next}`} aria-label="Sonraki gün" className="w-11 h-11 flex items-center justify-center text-mute"><Next size={18} /></Link> : <span className="w-11" />}
        </div>
        <Link href="/su/ayarlar" aria-label="Su ayarları" className={btn.icon}><Gear size={20} /></Link>
      </div>

      <section aria-label="Günlük ilerleme" className="rounded-[32px] p-5 flex gap-5 items-center bg-water-bg">
        <Progress style={data.progressStyle} frac={frac} idealFrac={data.goal ? ideal / data.goal : 0} pop={pop} total={total} />
        <div className="flex flex-col gap-2.5 flex-1 min-w-0">
          <div className="flex flex-col">
            <span className="num text-[40px] font-bold tracking-[-0.03em] leading-none" aria-live="polite">{fmtNum(total)}</span>
            <span className="text-sm text-mute">/ {fmtNum(data.goal)} ml · %{Math.round(frac * 100)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-mute">Hedefe kalan</span>
            <span className="num text-xl font-bold text-water">{left ? `${fmtNum(left)} ml` : 'Tamamlandı'}</span>
          </div>
          {data.isToday ? (
            <div className="flex flex-col gap-1 pt-2 border-t border-[#1E2A33]">
              <span className="text-[13px] text-ink-2">Saat {fmtHm(data.nowMin)} · ideal {fmtNum(ideal)} ml</span>
              <span className="text-[13px] font-extrabold" style={{ color: ahead >= 0 ? 'var(--color-lime)' : 'var(--color-orange)' }}>
                {ahead >= 0 ? `${fmtNum(ahead)} ml öndesin` : `${fmtNum(-ahead)} ml gerideysin`}
              </span>
            </div>
          ) : null}
        </div>
      </section>

      {data.prediction ? <PredictionCard p={data.prediction} goal={data.goal} total={total} /> : null}

      {!data.isToday ? (
        <div className="card px-4 py-3 flex items-center gap-3">
          <Clock size={18} className="text-mute" />
          <label htmlFor="past-time" className="text-sm font-bold flex-1">Bu güne eklenecek saat</label>
          <input id="past-time" type="time" value={pastTime} onChange={(e) => setPastTime(e.target.value)} className="h-11 rounded-xl bg-surface-2 border border-line px-3 num text-ink" />
        </div>
      ) : null}

      <section aria-label="İçecek türü" className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        {(Object.keys(DRINKS) as DrinkId[]).map((d) => (
          <button key={d} type="button" aria-pressed={drink === d} onClick={() => setDrink(d)}
            className={`h-10 px-4 rounded-full text-sm font-bold whitespace-nowrap border transition ${drink === d ? 'bg-ink text-bg border-ink' : 'bg-surface text-ink-2 border-line'}`}>
            {DRINKS[d].label}{DRINKS[d].hydration < 1 ? <span className="num text-xs opacity-70"> ×{DRINKS[d].hydration}</span> : null}
          </button>
        ))}
      </section>

      <section aria-label="Hızlı ekle" className="grid grid-cols-3 gap-2">
        {data.buttons.map((ml) => {
          const freq = data.frequent.includes(ml)
          return (
            <button key={ml} type="button" onClick={() => add({ ml, source: 'button' })} aria-label={`${ml} ml ekle${freq ? ' (sık kullandığın)' : ''}`}
              className={`relative h-14 rounded-[18px] num text-lg font-bold active:scale-95 transition ${freq ? 'bg-water text-water-ink' : 'bg-surface text-ink border border-line'}`}>
              {ml}
              {freq ? <span className="absolute top-1.5 right-2 text-[10px] font-sans font-extrabold tracking-wide opacity-70">SIK</span> : null}
            </button>
          )
        })}
      </section>
      {data.frequent.filter((f) => !data.buttons.includes(f)).length ? (
        <div className="flex gap-2 flex-wrap">
          {data.frequent.filter((f) => !data.buttons.includes(f)).map((ml) => (
            <button key={ml} type="button" onClick={() => add({ ml, source: 'button' })} className="h-10 px-4 rounded-full bg-water/15 text-water num font-bold">+{ml} · sık</button>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => setSheet('voice')} className="h-[52px] rounded-[18px] bg-water-bg border border-[#24323D] font-bold text-sm flex items-center justify-center gap-2">
          <Mic size={18} className="text-water" /> Söyle
        </button>
        <button type="button" onClick={() => setSheet('sip')} className="h-[52px] rounded-[18px] bg-water-bg border border-[#24323D] font-bold text-sm flex items-center justify-center gap-2">
          <Drop size={18} className="text-water" /> Yudum
        </button>
        <button type="button" onClick={() => setSheet('custom')} className="h-[52px] rounded-[18px] bg-water-bg border border-[#24323D] font-bold text-sm flex items-center justify-center gap-2">
          <Clock size={18} className="text-water" /> Özel
        </button>
      </div>

      <section aria-label="Kapların" className="flex flex-col gap-2">
        <div className="flex justify-between items-baseline px-1">
          <h2 className="font-extrabold">Kapların</h2>
          <Link href="/su/ayarlar#kaplar" className="text-sm text-mute font-semibold">Düzenle</Link>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
          {data.containers.map((c) => {
            const I = KIND_ICON[c.kind] ?? Glass
            return (
              <button key={c.id} type="button" onClick={() => setSheet({ container: c })}
                className={`shrink-0 w-[112px] h-[104px] rounded-[22px] p-3 flex flex-col justify-between text-left ${c.isDefault ? 'bg-coach border border-coach-line' : 'bg-surface'}`}>
                <I size={22} className="text-water" />
                <span className="flex flex-col"><span className="font-bold text-sm truncate">{c.name}</span><span className="num text-xs text-mute">{fmtNum(c.capacityMl)} ml</span></span>
              </button>
            )
          })}
        </div>
      </section>

      <section aria-label="Saatlik dağılım" className="card p-4 flex flex-col gap-2.5">
        <div className="flex justify-between items-baseline">
          <h2 className="font-extrabold text-[15px]">Saatlik dağılım</h2>
          <span className="text-[13px] text-mute">{distribution === null ? 'Dağılım skoru: veri az' : <>Dağılım skoru <b className="num text-ink">{distribution}</b></>}</span>
        </div>
        <HourBars hourly={hourly} wake={data.wake} sleep={data.sleep} nowMin={data.isToday ? data.nowMin : 1439} />
        {data.gap && data.gap.minutes >= 120 ? (
          <p className="text-[13px] text-ink-2">En uzun ara bugün: <b className="num">{fmtHm(data.gap.from)}–{fmtHm(data.gap.to)}</b> ({Math.floor(data.gap.minutes / 60)} sa {data.gap.minutes % 60} dk)</p>
        ) : null}
      </section>

      <section aria-label="Zaman çizelgesi" className="card px-4 py-3 flex flex-col">
        <div className="flex justify-between items-center min-h-11">
          <h2 className="font-extrabold text-[15px]">Kayıtlar <span className="text-mute font-semibold num">({logs.length})</span></h2>
          {logs.length >= 2 ? (
            mergeMode ? (
              <div className="flex gap-1">
                <button type="button" onClick={() => { setMergeMode(false); setSelected([]) }} className={btn.ghost + ' h-9 px-3 text-sm'}>Vazgeç</button>
                <button type="button" disabled={selected.length < 2} onClick={doMerge} className="h-9 px-3 rounded-full bg-water text-water-ink text-sm font-extrabold disabled:opacity-40">Birleştir ({selected.length})</button>
              </div>
            ) : (
              <button type="button" onClick={() => setMergeMode(true)} className="h-9 px-3 rounded-full text-sm font-bold text-mute flex items-center gap-1.5"><Merge size={16} /> Birleştir</button>
            )
          ) : null}
        </div>
        {logs.length === 0 ? <p className="text-sm text-mute py-4">{data.isToday ? 'Henüz kayıt yok. İlk bardağınla başla.' : 'Bu gün için kayıt yok. Yukarıdan saat seçip ekleyebilirsin.'}</p> : null}
        <ul>
          {[...logs].reverse().map((l) => (
            <li key={l.id} className="border-t border-surface-2 first:border-t-0">
              <button type="button" disabled={l.id < 0}
                onClick={() => mergeMode ? setSelected((s) => s.includes(l.id) ? s.filter((x) => x !== l.id) : [...s, l.id]) : setSheet({ edit: l })}
                className="w-full flex items-center gap-3 min-h-[54px] text-left" aria-pressed={mergeMode ? selected.includes(l.id) : undefined}>
                {mergeMode ? (
                  <span className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${selected.includes(l.id) ? 'bg-water border-water text-water-ink' : 'border-line-2'}`}>{selected.includes(l.id) ? <Check size={14} /> : null}</span>
                ) : null}
                <span className="num text-[13px] text-mute w-11">{fmtHm(l.at)}</span>
                <span className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-bold truncate">{DRINKS[l.drink]?.label ?? 'Su'}{l.containerName ? ` · ${l.containerName}` : ''}</span>
                  <span className="text-xs text-mute truncate">{SOURCE_LABEL[l.source] ?? l.source}{l.edited ? ' · düzenlendi' : ''}{l.drink !== 'water' && l.drink !== 'mineral' ? ` · ${fmtNum(l.effectiveMl)} ml sayıldı` : ''}</span>
                </span>
                <span className="num text-[15px] font-semibold text-water">+{fmtNum(l.ml)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/su/istatistik" className="card h-14 flex items-center justify-center gap-2 font-bold text-sm"><Chart size={18} className="text-water" /> İstatistikler</Link>
        <Link href={`/su?gun=${prev}`} className="card h-14 flex items-center justify-center gap-2 font-bold text-sm"><Clock size={18} className="text-water" /> Önceki günler</Link>
      </div>

      {/* Alt sayfalar */}
      <Sheet open={sheet === 'voice'} onClose={() => setSheet(null)} title="Söyle veya yaz">
        <VoiceForm ctx={{ nowMin: data.isToday ? data.nowMin : 1439, sipMl: data.sipMl, containers: data.containers }}
          onAdd={(ml, d, atMin) => { setSheet(null); add({ ml, drink: d, source: 'voice', at: atMin !== null ? isoAt(data.day, hmFromMin(atMin)) : undefined }) }} />
      </Sheet>
      <Sheet open={sheet === 'sip'} onClose={() => setSheet(null)} title="Yudum ekle">
        <SipForm sipMl={data.sipMl} calibrated={data.sipCalibrated} onAdd={(n) => { setSheet(null); add({ ml: n * data.sipMl, source: 'sip' }) }} />
      </Sheet>
      <Sheet open={sheet === 'custom'} onClose={() => setSheet(null)} title={data.isToday ? 'Özel miktar veya geçmiş saat' : 'Bu güne ekle'}>
        <CustomForm day={data.day} defaultTime={data.isToday ? hmFromMin(data.nowMin) : pastTime}
          onAdd={(ml, hm, changedTime) => { setSheet(null); add({ ml, source: 'custom', at: changedTime || !data.isToday ? isoAt(data.day, hm) : undefined }) }} />
      </Sheet>
      <Sheet open={!!sheet && typeof sheet === 'object' && 'container' in sheet} onClose={() => setSheet(null)}
        title={sheet && typeof sheet === 'object' && 'container' in sheet ? `${sheet.container.name} · ${fmtNum(sheet.container.capacityMl)} ml` : ''}>
        {sheet && typeof sheet === 'object' && 'container' in sheet ? (
          <ContainerForm c={sheet.container} onAdd={(ml, fill, source) => { setSheet(null); add({ ml, source, containerId: sheet.container.id, fill }) }} />
        ) : null}
      </Sheet>
      <Sheet open={!!sheet && typeof sheet === 'object' && 'edit' in sheet} onClose={() => setSheet(null)} title="Kaydı düzenle">
        {sheet && typeof sheet === 'object' && 'edit' in sheet ? (
          <EditForm log={sheet.edit} day={data.day}
            onSave={(ml, d, hm) => {
              const l = sheet.edit
              setSheet(null)
              start(async () => {
                const r = await updateWater({ id: l.id, ml, drink: d, at: isoAt(data.day, hm) })
                if (!r.ok) showToast({ kind: 'info', text: r.error })
                router.refresh()
              })
            }}
            onDelete={() => {
              const l = sheet.edit
              setSheet(null)
              setLogs((x) => x.filter((y) => y.id !== l.id))
              start(async () => { await deleteWater(l.id); router.refresh() })
            }} />
        ) : null}
      </Sheet>

      {dup ? (
        <div role="alertdialog" aria-label="Olası çift kayıt" className="fixed inset-x-4 bottom-28 z-40 max-w-md mx-auto rounded-[24px] bg-surface border border-line-2 p-4 flex flex-col gap-3 shadow-2xl">
          <p className="text-sm font-semibold">{dup.ml} ml az önce de eklendi. Bu ikinci bir bardak mı?</p>
          <div className="flex gap-2">
            <button type="button" className="h-11 px-4 rounded-full bg-water text-water-ink font-extrabold text-sm" onClick={() => { const p = dup; setDup(null); add(p, true) }}>Evet, ekle</button>
            <button type="button" className={btn.ghost + ' text-sm'} onClick={() => setDup(null)}>Hayır, çift kayıt</button>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div role="status" className="fixed inset-x-4 bottom-28 z-40 max-w-md mx-auto h-14 rounded-full bg-ink text-bg flex items-center justify-between pl-5 pr-2 shadow-2xl">
          <span className="text-[15px] font-bold truncate">{toast.kind === 'undo' ? `+${fmtNum(toast.ml)} ml eklendi` : toast.text}</span>
          {toast.kind === 'undo' ? (
            <button type="button" onClick={() => undo(toast.id)} className="h-11 px-5 rounded-full bg-bg text-ink font-extrabold text-sm">Geri al</button>
          ) : <button type="button" onClick={() => setToast(null)} className="h-11 px-4 text-sm font-bold">Tamam</button>}
        </div>
      ) : null}
    </div>
  )
}

function Progress({ style, frac, idealFrac, pop, total }: { style: string; frac: number; idealFrac: number; pop: number; total: number }) {
  const f = Math.min(1, frac)
  if (style === 'ring') {
    return (
      <div key={pop} className="animate-[pop_.35s_ease]">
        <Ring size={132} stroke={14} value={f} color="var(--color-water)" track="#1E2A33" label={`Hedefin yüzde ${Math.round(frac * 100)}'i`}>
          <Drop size={26} className="text-water" />
        </Ring>
      </div>
    )
  }
  const h = style === 'wave' ? 132 : 220
  const w = style === 'wave' ? 132 : 120
  const inner = h - 4
  return (
    <div key={pop} role="img" aria-label={`Hedefin yüzde ${Math.round(frac * 100)}'i, ${total} ml`}
      className={`relative shrink-0 overflow-hidden border-2 border-[#24323D] bg-[#0C1115] animate-[pop_.35s_ease] ${style === 'wave' ? 'rounded-full' : 'rounded-[26px_26px_34px_34px]'}`} style={{ width: w, height: h }}>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-water to-[#2F8FD1] transition-[height] duration-700 ease-out" style={{ height: inner * f }} />
      {f > 0 && f < 1 ? (
        <svg className="absolute left-0 transition-[bottom] duration-700 ease-out animate-[wave_3s_linear_infinite]" style={{ bottom: inner * f - 7 }} width={w * 2} height="14" viewBox="0 0 264 14" preserveAspectRatio="none" aria-hidden>
          <path d="M0 7 C 16 0, 33 14, 50 7 S 83 0, 100 7 S 116 14, 132 7 S 165 0, 182 7 S 215 14, 232 7 S 254 0, 264 7 V14 H0 Z" fill="var(--color-water)" />
        </svg>
      ) : null}
      {idealFrac > 0 && idealFrac < 1 ? <div className="absolute inset-x-2.5 border-t-2 border-dashed border-ink/50" style={{ bottom: inner * idealFrac }} aria-hidden /> : null}
    </div>
  )
}

function PredictionCard({ p, goal, total }: { p: NonNullable<Data['prediction']>; goal: number; total: number }) {
  const reached = total >= goal
  return (
    <section aria-label="Tahmin" className="card px-4 py-3.5 flex gap-3 items-start">
      <Trend size={20} className="text-water shrink-0 mt-0.5" />
      <div className="flex flex-col gap-1 text-sm leading-relaxed text-ink-2">
        {reached ? <span><b className="text-ink">Bugünkü hedef tamam.</b> Gün sonu tahmini {fmtNum(p.endTotal)} ml.</span> : (
          <span>
            Bu tempoyla gün sonu <b className="text-ink num">{fmtNum(p.endTotal)} ml</b>
            {p.goalAt !== null ? <>; hedefe yaklaşık <b className="text-ink num">{fmtHm(p.goalAt)}</b>'ta ulaşırsın.</> : <>; hedefe ulaşmak için <b className="text-ink num">{fmtNum(Math.max(0, goal - p.endTotal))} ml</b> daha gerekiyor.</>}
          </span>
        )}
        {p.vsHistory !== null && Math.abs(p.vsHistory) >= 150 ? (
          <span className="text-[13px]">Geçmiş günlerde bu saate göre {p.vsHistory > 0 ? <b className="text-lime">{fmtNum(p.vsHistory)} ml öndesin</b> : <b className="text-orange">{fmtNum(-p.vsHistory)} ml gerisindesin</b>}.</span>
        ) : null}
        <span className="text-xs text-mute">Tahmin güveni: {p.confidence}{p.basis === 'tempo' ? ' (henüz yeterli geçmiş yok, bugünkü tempoya göre)' : ''}</span>
      </div>
    </section>
  )
}

function HourBars({ hourly, wake, sleep, nowMin }: { hourly: number[]; wake: number; sleep: number; nowMin: number }) {
  const from = Math.floor(wake / 60)
  const to = Math.min(23, Math.ceil((sleep <= wake ? 1439 : sleep) / 60))
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  const max = Math.max(300, ...hourly)
  return (
    <div>
      <div className="grid gap-[3px] items-end h-[72px]" style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}>
        {hours.map((h) => {
          const v = hourly[h]
          const future = h * 60 > nowMin
          return <div key={h} title={`${h}:00 · ${v} ml`} className="rounded-[4px]" style={{ height: future ? 4 : Math.max(4, (v / max) * 70), background: future ? 'var(--color-surface-2)' : v ? 'var(--color-water)' : 'var(--color-surface-3)' }} />
        })}
      </div>
      <div className="flex justify-between mt-1.5 num text-[11px] text-mute">
        <span>{String(from).padStart(2, '0')}</span><span>{String(Math.round((from + to) / 2)).padStart(2, '0')}</span><span>{String(to).padStart(2, '0')}</span>
      </div>
    </div>
  )
}

type Recog = { lang: string; interimResults: boolean; maxAlternatives: number; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null }

function VoiceForm({ ctx, onAdd }: { ctx: { nowMin: number; sipMl: number; containers: ContainerView[] }; onAdd: (ml: number, drink: DrinkId, atMin: number | null) => void }) {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const recRef = useRef<Recog | null>(null)
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recog; webkitSpeechRecognition?: new () => Recog }
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition))
    return () => recRef.current?.stop()
  }, [])
  const parsed = useMemo(() => (text.trim() ? parseWaterSpeech(text, ctx) : null), [text, ctx])
  const listen = () => {
    const w = window as unknown as { SpeechRecognition?: new () => Recog; webkitSpeechRecognition?: new () => Recog }
    const C = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!C) return
    const r = new C()
    r.lang = 'tr-TR'; r.interimResults = true; r.maxAlternatives = 1
    r.onresult = (e) => setText(Array.from(e.results).map((x) => x[0].transcript).join(' '))
    r.onerror = (e) => { setErr(e.error === 'not-allowed' ? 'Mikrofon izni verilmedi.' : 'Ses anlaşılamadı, yazarak deneyebilirsin.'); setListening(false) }
    r.onend = () => setListening(false)
    recRef.current = r; setErr(null); setListening(true); r.start()
  }
  return (
    <form className="flex flex-col gap-4 pb-4" onSubmit={(e) => { e.preventDefault(); if (parsed) onAdd(parsed.ml, parsed.drink, parsed.atMin) }}>
      {supported ? (
        <button type="button" onClick={() => (listening ? recRef.current?.stop() : listen())} aria-pressed={listening}
          className={`self-center w-24 h-24 rounded-full flex items-center justify-center transition ${listening ? 'bg-water text-water-ink animate-pulse' : 'bg-surface-2 text-water'}`} aria-label={listening ? 'Dinlemeyi durdur' : 'Konuşmaya başla'}>
          <Mic size={36} />
        </button>
      ) : <p className="text-[13px] text-mute">Bu tarayıcıda sesli giriş yok; cümleni yazabilirsin.</p>}
      <label htmlFor="v-text" className="sr-only">Ne içtin?</label>
      <input id="v-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Örn: yarım saat önce 2 bardak çay içtim"
        className="h-14 rounded-2xl bg-surface-2 border border-line px-4 text-[16px] text-ink placeholder:text-faint outline-none focus:border-water" />
      <div className="min-h-[52px] rounded-2xl px-4 py-3 bg-water-bg text-sm" aria-live="polite">
        {parsed ? <span>Anladığım: <b className="text-ink">{parsed.label}</b></span> : text.trim() ? <span className="text-orange">Miktarı anlayamadım. "300 ml", "bir bardak", "yarım şişe" gibi söyle.</span> : <span className="text-mute">Örnekler: "300 ml su", "şişemi bitirdim", "saat 2'de bir bardak içmiştim"</span>}
      </div>
      {err ? <p className="text-sm text-danger" role="alert">{err}</p> : null}
      <button type="submit" disabled={!parsed} className="h-14 rounded-full bg-water text-water-ink font-extrabold text-[17px] disabled:opacity-40">{parsed ? `${parsed.ml} ml ekle` : 'Ekle'}</button>
    </form>
  )
}

function SipForm({ sipMl, calibrated, onAdd }: { sipMl: number; calibrated: boolean; onAdd: (n: number) => void }) {
  const [n, setN] = useState(3)
  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-center gap-5">
        <button type="button" aria-label="Azalt" onClick={() => setN(Math.max(1, n - 1))} className="w-14 h-14 rounded-2xl bg-surface-2 text-2xl font-bold">−</button>
        <div className="flex flex-col items-center w-28">
          <span className="num text-[56px] font-bold leading-none">{n}</span>
          <span className="text-sm text-mute">yudum</span>
        </div>
        <button type="button" aria-label="Artır" onClick={() => setN(Math.min(20, n + 1))} className="w-14 h-14 rounded-2xl bg-surface-2 text-2xl font-bold">+</button>
      </div>
      <p className="text-center text-sm text-ink-2"><b className="num text-ink">{n} × {sipMl} ml = {fmtNum(n * sipMl)} ml</b></p>
      {!calibrated ? (
        <p className="text-[13px] text-mute text-center">Yudumun varsayılan olarak {sipMl} ml sayılıyor. <Link href="/su/ayarlar#yudum" className="text-water font-bold">Kendi yudumunu ölç</Link></p>
      ) : null}
      <button type="button" className="h-14 rounded-full bg-water text-water-ink font-extrabold text-[17px]" onClick={() => onAdd(n)}>{fmtNum(n * sipMl)} ml ekle</button>
    </div>
  )
}

function CustomForm({ day, defaultTime, onAdd }: { day: string; defaultTime: string; onAdd: (ml: number, hm: string, changedTime: boolean) => void }) {
  const [ml, setMl] = useState('')
  const [hm, setHm] = useState(defaultTime)
  const v = Number(ml)
  const valid = v >= 1 && v <= 3000
  return (
    <form className="flex flex-col gap-4 pb-4" onSubmit={(e) => { e.preventDefault(); if (valid) onAdd(v, hm, hm !== defaultTime) }}>
      <label htmlFor="c-ml" className="sr-only">Miktar (ml)</label>
      <div className="flex items-baseline justify-center gap-2">
        <input id="c-ml" autoFocus inputMode="numeric" placeholder="0" value={ml} onChange={(e) => setMl(e.target.value.replace(/\D/g, '').slice(0, 4))}
          className="w-40 bg-transparent text-center num text-[60px] font-bold outline-none placeholder:text-faint" />
        <span className="text-xl font-bold text-mute">ml</span>
      </div>
      <div className="flex items-center gap-3">
        <label htmlFor="c-time" className="text-sm font-bold flex-1">Saat <span className="text-mute font-normal">· {dayLabel(day)}</span></label>
        <input id="c-time" type="time" value={hm} onChange={(e) => setHm(e.target.value)} className="h-12 rounded-xl bg-surface-2 border border-line px-3 num text-ink text-lg" />
      </div>
      <button type="submit" disabled={!valid} className="h-14 rounded-full bg-water text-water-ink font-extrabold text-[17px] disabled:opacity-40">Ekle</button>
    </form>
  )
}

function ContainerForm({ c, onAdd }: { c: ContainerView; onAdd: (ml: number, fill: number, source: 'container' | 'fill' | 'finish') => void }) {
  const [fill, setFill] = useState(c.lastFill || 1)
  const ml = Math.round(c.capacityMl * fill)
  const I = KIND_ICON[c.kind] ?? Glass
  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center gap-5">
        <div className="relative w-24 h-40 rounded-[18px_18px_26px_26px] border-2 border-[#24323D] bg-[#0C1115] overflow-hidden shrink-0" aria-hidden>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-water to-[#2F8FD1] transition-[height] duration-200" style={{ height: `${fill * 100}%` }} />
          <I size={20} className="absolute top-2 left-1/2 -translate-x-1/2 text-ink/60" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="num text-[44px] font-bold leading-none">{fmtNum(ml)} <span className="text-lg text-mute">ml</span></span>
          <span className="text-sm text-mute">Doluluk %{Math.round(fill * 100)}</span>
        </div>
      </div>
      <label htmlFor="fill" className="sr-only">Doluluk oranı</label>
      <input id="fill" type="range" min={5} max={100} step={5} value={Math.round(fill * 100)} onChange={(e) => setFill(Number(e.target.value) / 100)} className="w-full accent-[#6CC7FF] h-8" />
      <div className="grid grid-cols-4 gap-2">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <button key={f} type="button" aria-pressed={fill === f} onClick={() => setFill(f)} className={`h-11 rounded-full text-sm font-bold ${fill === f ? 'bg-ink text-bg' : 'bg-surface-2 text-ink-2'}`}>
            {f === 0.25 ? 'Çeyrek' : f === 0.5 ? 'Yarım' : f === 0.75 ? '¾' : 'Tam'}
          </button>
        ))}
      </div>
      <button type="button" className="h-14 rounded-full bg-water text-water-ink font-extrabold text-[17px]" onClick={() => onAdd(ml, fill, fill === 1 ? 'container' : 'fill')}>{fmtNum(ml)} ml ekle</button>
      {c.kind !== 'glass' && c.kind !== 'cup' ? (
        <button type="button" className={btn.secondary + ' h-12'} onClick={() => onAdd(c.capacityMl, 1, 'finish')}>Hepsini bitirdim · {fmtNum(c.capacityMl)} ml</button>
      ) : null}
    </div>
  )
}

function EditForm({ log, day, onSave, onDelete }: { log: WaterLogView; day: string; onSave: (ml: number, drink: DrinkId, hm: string) => void; onDelete: () => void }) {
  const [ml, setMl] = useState(String(log.ml))
  const [d, setD] = useState<DrinkId>(log.drink)
  const [hm, setHm] = useState(hmFromMin(log.at))
  const v = Number(ml)
  return (
    <form className="flex flex-col gap-4 pb-4" onSubmit={(e) => { e.preventDefault(); if (v >= 1 && v <= 3000) onSave(v, d, hm) }}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="e-ml" className="block text-sm font-bold mb-2">Miktar (ml)</label>
          <input id="e-ml" inputMode="numeric" value={ml} onChange={(e) => setMl(e.target.value.replace(/\D/g, '').slice(0, 4))} className="w-full h-12 rounded-xl bg-surface-2 border border-line px-3 num text-lg text-ink" />
        </div>
        <div>
          <label htmlFor="e-time" className="block text-sm font-bold mb-2">Saat</label>
          <input id="e-time" type="time" value={hm} onChange={(e) => setHm(e.target.value)} className="w-full h-12 rounded-xl bg-surface-2 border border-line px-3 num text-lg text-ink" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="İçecek">
        {(Object.keys(DRINKS) as DrinkId[]).map((x) => (
          <button key={x} type="button" aria-pressed={d === x} onClick={() => setD(x)} className={`h-10 px-3.5 rounded-full text-sm font-bold border ${d === x ? 'bg-ink text-bg border-ink' : 'bg-surface-2 text-ink-2 border-line'}`}>{DRINKS[x].label}</button>
        ))}
      </div>
      <p className="text-xs text-mute">Kaynak: {SOURCE_LABEL[log.source] ?? log.source} · {dayLabel(day)}{log.edited ? ' · daha önce düzenlendi' : ''}</p>
      <button type="submit" className="h-14 rounded-full bg-water text-water-ink font-extrabold text-[17px]">Kaydet</button>
      <button type="button" onClick={onDelete} className="h-12 rounded-full border border-[#5A2A22] text-danger font-bold flex items-center justify-center gap-2"><Trash size={18} /> Kaydı sil</button>
    </form>
  )
}

/** ISO zamanı Türkiye saatine göre gün içi dakikaya çevirir (UTC+3 sabit). */
function minuteFromIso(iso: string) { const d = new Date(iso); return (d.getUTCHours() * 60 + d.getUTCMinutes() + 180) % 1440 }
function todayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
function shiftDay(day: string, n: number) {
  const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
}
function dayLabel(day: string) {
  return new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'long', weekday: 'short' }).format(new Date(day + 'T12:00:00Z'))
}
