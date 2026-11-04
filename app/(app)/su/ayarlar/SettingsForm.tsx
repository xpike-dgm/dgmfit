'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { btn } from '@/components/ui'
import { Check, Trash } from '@/components/icons'
import { fmtNum } from '@/lib/calc'
import { archiveContainer, saveContainer, saveSipCalibration, saveWaterGoal, saveWaterSettings } from '../actions'

interface C { id: string; name: string; kind: string; capacityMl: number; isDefault: boolean }
const DAYS: [number, string][] = [[1, 'Pazartesi'], [2, 'Salı'], [3, 'Çarşamba'], [4, 'Perşembe'], [5, 'Cuma'], [6, 'Cumartesi'], [0, 'Pazar']]
const KINDS: [string, string][] = [['glass', 'Bardak'], ['bottle', 'Şişe'], ['thermos', 'Termos'], ['cup', 'Kupa']]
const input = 'h-12 rounded-xl bg-surface-2 border border-line px-3 num text-ink text-[16px] outline-none focus:border-water'

export default function SettingsForm(props: {
  goal: { baseMl: number; weekday: (number | null)[] }
  suggested: number
  buttons: number[]
  containers: C[]
  sip: { ml: number; calibrated: boolean }
  progressStyle: string
  feedback: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ key: string; text: string; ok: boolean } | null>(null)
  const done = (key: string, r: { ok: boolean; error?: string }, text = 'Kaydedildi') => {
    setMsg({ key, ok: r.ok, text: r.ok ? text : (r as { error: string }).error })
    if (r.ok) router.refresh()
  }

  // Hedef
  const [base, setBase] = useState(String(props.goal.baseMl))
  const [wd, setWd] = useState<string[]>(props.goal.weekday.map((x) => (x ? String(x) : '')))
  // Butonlar
  const [buttons, setButtons] = useState<string[]>(props.buttons.map(String))
  // Görünüm
  const [style, setStyle] = useState(props.progressStyle)
  const [feedback, setFeedback] = useState(props.feedback)
  // Yudum
  const [vol, setVol] = useState('200')
  const [sips, setSips] = useState('8')
  // Yeni kap
  const [nc, setNc] = useState({ name: '', kind: 'bottle', cap: '' })

  const Msg = ({ k }: { k: string }) => msg?.key === k ? <p role="status" className={`text-sm font-semibold ${msg.ok ? 'text-lime' : 'text-danger'}`}>{msg.text}</p> : null

  return (
    <div className="flex flex-col gap-3 mt-2 pb-6">
      <section aria-labelledby="h-goal" className="card p-5 flex flex-col gap-4">
        <h2 id="h-goal" className="font-extrabold">Günlük hedef</h2>
        <div className="flex items-center gap-3">
          <label htmlFor="base" className="flex-1 text-sm text-ink-2">Her gün için temel hedef</label>
          <input id="base" inputMode="numeric" value={base} onChange={(e) => setBase(e.target.value.replace(/\D/g, ''))} className={input + ' w-28 text-right'} />
          <span className="text-sm text-mute">ml</span>
        </div>
        <p className="text-[13px] text-mute -mt-2">Kilona göre önerilen: <button type="button" className="text-water font-bold num" onClick={() => setBase(String(props.suggested))}>{fmtNum(props.suggested)} ml</button></p>
        <details className="group">
          <summary className="cursor-pointer text-sm font-bold text-ink-2 list-none flex items-center justify-between min-h-11">Haftanın günlerine farklı hedef <span className="text-mute group-open:rotate-90 transition">›</span></summary>
          <div className="flex flex-col gap-2 mt-2">
            {DAYS.map(([dow, label]) => (
              <div key={dow} className="flex items-center gap-3">
                <label htmlFor={`wd-${dow}`} className="flex-1 text-sm">{label}</label>
                <input id={`wd-${dow}`} inputMode="numeric" placeholder={base || '—'} value={wd[dow]}
                  onChange={(e) => setWd((x) => x.map((v, i) => (i === dow ? e.target.value.replace(/\D/g, '') : v)))} className={input + ' w-28 text-right'} />
                <span className="text-sm text-mute">ml</span>
              </div>
            ))}
            <p className="text-xs text-mute">Boş bırakılan günlerde temel hedef geçerlidir.</p>
          </div>
        </details>
        <p className="text-xs text-mute">Yeni hedef bugünden itibaren geçerli olur; geçmiş günlerin istatistikleri o günkü hedefle değerlendirilmeye devam eder.</p>
        <Msg k="goal" />
        <button type="button" disabled={pending} className="h-12 rounded-full bg-water text-water-ink font-extrabold"
          onClick={() => start(async () => done('goal', await saveWaterGoal({ baseMl: Number(base), weekday: wd.map((v) => (v ? Number(v) : null)) })))}>Hedefi kaydet</button>
      </section>

      <section aria-labelledby="h-btn" className="card p-5 flex flex-col gap-4">
        <h2 id="h-btn" className="font-extrabold">Hızlı ekleme butonları</h2>
        <div className="grid grid-cols-4 gap-2">
          {buttons.map((b, i) => (
            <div key={i} className="relative">
              <label htmlFor={`b-${i}`} className="sr-only">{i + 1}. buton (ml)</label>
              <input id={`b-${i}`} inputMode="numeric" value={b} onChange={(e) => setButtons((x) => x.map((v, j) => (j === i ? e.target.value.replace(/\D/g, '').slice(0, 4) : v)))} className={input + ' w-full text-center'} />
              {buttons.length > 1 ? <button type="button" aria-label={`${b} ml butonunu kaldır`} onClick={() => setButtons((x) => x.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-surface-3 text-mute text-xs font-bold">×</button> : null}
            </div>
          ))}
          {buttons.length < 8 ? <button type="button" onClick={() => setButtons((x) => [...x, ''])} className="h-12 rounded-xl border border-dashed border-line-2 text-mute font-bold">+</button> : null}
        </div>
        <p className="text-xs text-mute">En fazla 8 buton. En sık içtiğin miktarlar su ekranında otomatik olarak vurgulanır.</p>
        <Msg k="btn" />
        <button type="button" disabled={pending} className="h-12 rounded-full bg-water text-water-ink font-extrabold"
          onClick={() => start(async () => done('btn', await saveWaterSettings({ buttons: buttons.map(Number).filter((x) => x > 0), progressStyle: style as 'bottle', feedback })))}>Butonları kaydet</button>
      </section>

      <section id="kaplar" aria-labelledby="h-c" className="card p-5 flex flex-col gap-3 scroll-mt-4">
        <h2 id="h-c" className="font-extrabold">Kapların</h2>
        <ul className="flex flex-col">
          {props.containers.map((c) => (
            <li key={c.id} className="flex items-center gap-3 min-h-[52px] border-t border-surface-2 first:border-t-0">
              <span className="flex-1 flex flex-col">
                <span className="font-bold text-sm">{c.name} {c.isDefault ? <span className="text-xs text-lime">· varsayılan</span> : null}</span>
                <span className="text-xs text-mute">{KINDS.find((k) => k[0] === c.kind)?.[1]} · <span className="num">{fmtNum(c.capacityMl)} ml</span></span>
              </span>
              {!c.isDefault ? <button type="button" className="h-9 px-3 rounded-full text-xs font-bold text-mute border border-line" onClick={() => start(async () => done('c', await saveContainer({ id: c.id, name: c.name, kind: c.kind as 'glass', capacityMl: c.capacityMl, isDefault: true }), 'Varsayılan kap değişti'))}>Varsayılan yap</button> : null}
              <button type="button" aria-label={`${c.name} kabını kaldır`} className="w-10 h-10 flex items-center justify-center text-mute" onClick={() => start(async () => done('c', await archiveContainer(c.id), 'Kap kaldırıldı'))}><Trash size={18} /></button>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-[1fr_auto] gap-2 pt-2 border-t border-surface-2">
          <label htmlFor="nc-name" className="sr-only">Kap adı</label>
          <input id="nc-name" placeholder="Kap adı (ör. Spor şişem)" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value.slice(0, 30) })} className={input + ' font-sans'} />
          <div className="flex items-center gap-1.5">
            <label htmlFor="nc-cap" className="sr-only">Kapasite (ml)</label>
            <input id="nc-cap" inputMode="numeric" placeholder="ml" value={nc.cap} onChange={(e) => setNc({ ...nc, cap: e.target.value.replace(/\D/g, '').slice(0, 4) })} className={input + ' w-20 text-right'} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Kap türü">
          {KINDS.map(([k, l]) => (
            <button key={k} type="button" aria-pressed={nc.kind === k} onClick={() => setNc({ ...nc, kind: k })} className={`h-10 px-3.5 rounded-full text-sm font-bold border ${nc.kind === k ? 'bg-ink text-bg border-ink' : 'bg-surface-2 text-ink-2 border-line'}`}>{l}</button>
          ))}
        </div>
        <Msg k="c" />
        <button type="button" disabled={pending || !nc.name || !nc.cap} className={btn.secondary + ' h-12 disabled:opacity-40'}
          onClick={() => start(async () => { const r = await saveContainer({ name: nc.name, kind: nc.kind as 'glass', capacityMl: Number(nc.cap) }); done('c', r, 'Kap eklendi'); if (r.ok) setNc({ name: '', kind: 'bottle', cap: '' }) })}>Kap ekle</button>
      </section>

      <section id="yudum" aria-labelledby="h-s" className="card p-5 flex flex-col gap-3 scroll-mt-4">
        <h2 id="h-s" className="font-extrabold">Yudum kalibrasyonu</h2>
        <p className="text-sm text-ink-2 leading-relaxed">Hacmini bildiğin bir bardağı yudum sayarak bitir ve aşağıya yaz. Şu an bir yudum <b className="num text-ink">{props.sip.ml} ml</b> sayılıyor{props.sip.calibrated ? ' (kalibre edildi)' : ' (varsayılan)'}.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="s-vol" className="block text-sm font-bold mb-1.5">Bardak hacmi (ml)</label>
            <input id="s-vol" inputMode="numeric" value={vol} onChange={(e) => setVol(e.target.value.replace(/\D/g, '').slice(0, 4))} className={input + ' w-full'} />
          </div>
          <div>
            <label htmlFor="s-n" className="block text-sm font-bold mb-1.5">Kaç yudumda bitti?</label>
            <input id="s-n" inputMode="numeric" value={sips} onChange={(e) => setSips(e.target.value.replace(/\D/g, '').slice(0, 3))} className={input + ' w-full'} />
          </div>
        </div>
        {Number(vol) > 0 && Number(sips) > 0 ? <p className="text-sm text-mute">Bir yudumun ≈ <b className="num text-ink">{Math.round(Number(vol) / Number(sips))} ml</b></p> : null}
        <Msg k="s" />
        <button type="button" disabled={pending} className="h-12 rounded-full bg-water text-water-ink font-extrabold"
          onClick={() => start(async () => { const r = await saveSipCalibration(Number(vol), Number(sips)); done('s', r, r.ok ? `Yudum hacmin ${r.sipMl} ml olarak kaydedildi` : '') })}>Kalibre et</button>
      </section>

      <section aria-labelledby="h-v" className="card p-5 flex flex-col gap-3">
        <h2 id="h-v" className="font-extrabold">Görünüm</h2>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="İlerleme göstergesi">
          {[['bottle', 'Şişe'], ['wave', 'Dalga'], ['ring', 'Halka']].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={style === k} onClick={() => setStyle(k)} className={`h-12 rounded-2xl text-sm font-bold border flex items-center justify-center gap-1.5 ${style === k ? 'bg-water text-water-ink border-water' : 'bg-surface-2 text-ink-2 border-line'}`}>
              {style === k ? <Check size={14} /> : null}{l}
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between min-h-12 cursor-pointer">
          <span className="text-sm">Ekleyince animasyon ve titreşim</span>
          <input type="checkbox" checked={feedback} onChange={(e) => setFeedback(e.target.checked)} className="w-6 h-6 accent-[#6CC7FF]" />
        </label>
        <Msg k="v" />
        <button type="button" disabled={pending} className="h-12 rounded-full bg-water text-water-ink font-extrabold"
          onClick={() => start(async () => done('v', await saveWaterSettings({ buttons: props.buttons, progressStyle: style as 'bottle', feedback })))}>Görünümü kaydet</button>
      </section>
    </div>
  )
}
