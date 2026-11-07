'use client'
import { useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { StylePrefs } from '@/lib/cards/style'
import { shrinkImage } from '@/lib/client-image'
import { saveStyleAction } from '../actions'

type Opt<T extends string> = [T, string]
function Seg<T extends string>({ label, hint, value, opts, onPick, testId }: { label: string; hint?: string; value: T; opts: Opt<T>[]; onPick: (v: T) => void; testId: string }) {
  return (
    <div className="flex flex-col gap-2 py-3 border-t border-line first:border-0" data-testid={testId}>
      <span className="flex flex-col"><b className="text-[15px]">{label}</b>{hint ? <span className="text-[12.5px] text-mute leading-snug">{hint}</span> : null}</span>
      <div role="radiogroup" aria-label={label} className="grid gap-1 p-1 rounded-full bg-surface-2" style={{ gridTemplateColumns: `repeat(${opts.length}, minmax(0, 1fr))` }}>
        {opts.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onPick(v)}
            className="min-h-10 px-1 rounded-full text-[13px] font-bold text-mute aria-checked:bg-surface aria-checked:text-ink aria-checked:shadow-sm">{l}</button>
        ))}
      </div>
    </div>
  )
}
function Toggle({ label, hint, on, onChange, testId }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void; testId: string }) {
  return (
    <label className="flex items-center justify-between gap-3 min-h-11 py-3 border-t border-line first:border-0 cursor-pointer">
      <span className="flex flex-col"><b className="text-[15px]">{label}</b><span className="text-[12.5px] text-mute leading-snug">{hint}</span></span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} data-testid={testId}
        className="appearance-none w-12 h-7 rounded-full bg-surface-3 relative shrink-0 transition checked:bg-acc before:content-[''] before:absolute before:top-1 before:left-1 before:w-5 before:h-5 before:rounded-full before:bg-white before:transition checked:before:translate-x-5" />
    </label>
  )
}
const Box = ({ title, children }: { title: string; children: ReactNode }) => (
  <section aria-label={title} className="card px-4 py-1 flex flex-col"><h2 className="text-[13px] font-extrabold text-mute tracking-[0.06em] uppercase pt-3">{title}</h2>{children}</section>
)

export default function StyleForm({ initial, more = false }: { initial: StylePrefs; more?: boolean }) {
  const [s, setS] = useState(initial)
  const [msg, setMsg] = useState<string | null>(null)
  const [, start] = useTransition()
  const file = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const save = (patch: Partial<StylePrefs>) => {
    const old = s
    setS({ ...s, ...patch, units: { ...s.units, ...(patch.units ?? {}) } }); setMsg(null)
    start(async () => {
      const r = await saveStyleAction(patch).catch(() => null)
      if (!r?.ok) { setS(old); setMsg(r && !r.ok ? r.error : 'Kaydedilemedi') } else { setMsg('Kaydedildi'); router.refresh() }
    })
  }
  const upload = async (f: File) => {
    setMsg('Fotoğraf yükleniyor…')
    const fd = new FormData(); fd.set('file', await shrinkImage(f, 1280, 0.82), 'bant.jpg'); fd.set('kind', 'band')
    const r = await fetch('/api/media', { method: 'POST', body: fd }); const j = await r.json().catch(() => ({}))
    if (!r.ok || !j.id) { setMsg(j.error ?? 'Yüklenemedi'); return }
    save({ band: 'photo', bandMedia: j.id })
  }
  return (
    <div className="flex flex-col gap-3" data-testid="style-form">
      <Box title="Görünüm">
        {more ? null : <>
        <Seg testId="st-radius" label="Köşeler" value={s.radius} opts={[['sharp', 'Keskin'], ['normal', 'Normal'], ['round', 'Yuvarlak']]} onPick={(v) => save({ radius: v })} />
        <Seg testId="st-density" label="Yoğunluk" hint="Sıkı: ekrana daha çok şey sığar. Ferah: daha çok boşluk." value={s.density} opts={[['compact', 'Sıkı'], ['normal', 'Normal'], ['airy', 'Ferah']]} onPick={(v) => save({ density: v })} />
        </>}
        <Seg testId={more ? 'st-font-more' : 'st-font'} label={more ? 'Diğer yazı tipleri' : 'Yazı tipi'} value={s.font} opts={[['default', 'Manrope'], ['grotesk', 'Grotesk'], ['rounded', 'Yuvarlak'], ['serif', 'Klasik'], ['system', 'Telefon']]} onPick={(v) => save({ font: v })} />
        <Seg testId="st-icons" label="Simgeler" value={s.icons} opts={[['thin', 'İnce'], ['normal', 'Normal'], ['bold', 'Kalın']]} onPick={(v) => save({ icons: v })} />
        <Seg testId="st-band" label="Bant arka planı" hint="Ekranların üstündeki renkli bant." value={s.band} opts={[['gradient', 'Degrade'], ['flat', 'Düz'], ['photo', 'Fotoğraf']]}
          onPick={(v) => (v === 'photo' && !s.bandMedia ? file.current?.click() : save({ band: v }))} />
        <input ref={file} type="file" accept="image/*" className="sr-only" data-testid="band-photo-input" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f) }} />
        {s.band === 'photo' ? <button type="button" onClick={() => file.current?.click()} className="mb-3 h-10 rounded-full border border-line-2 text-[13px] font-bold">Başka fotoğraf seç</button> : null}
      </Box>
      <Box title="Erişilebilirlik">
        <Toggle testId="st-motion" label="Hareketi azalt" hint="Animasyonlar ve geçişler kapanır." on={s.motion === 'reduce'} onChange={(v) => save({ motion: v ? 'reduce' : 'normal' })} />
        <Toggle testId="st-contrast" label="Yüksek kontrast" hint="Soluk yazılar koyulaşır, kart kenarları belirginleşir. Renkler'de renk körlüğüne uygun palet de var." on={s.contrast === 'high'} onChange={(v) => save({ contrast: v ? 'high' : 'normal' })} />
      </Box>
      <Box title="Birimler">
        <Seg testId="st-weight" label="Ağırlık" value={s.units.weight} opts={[['kg', 'kg'], ['lb', 'lb']]} onPick={(v) => save({ units: { ...s.units, weight: v } })} />
        <Seg testId="st-volume" label="Sıvı" value={s.units.volume} opts={[['ml', 'ml'], ['oz', 'oz']]} onPick={(v) => save({ units: { ...s.units, volume: v } })} />
        <Seg testId="st-energy" label="Enerji" value={s.units.energy} opts={[['kcal', 'kcal'], ['kJ', 'kJ']]} onPick={(v) => save({ units: { ...s.units, energy: v } })} />
        <Seg testId="st-length" label="Uzunluk" value={s.units.length} opts={[['cm', 'cm'], ['in', 'inç']]} onPick={(v) => save({ units: { ...s.units, length: v } })} />
        <p className="text-[12px] text-mute pb-3 leading-snug">Veriler her zaman metrik saklanır; seçtiğin birim ana ekranların özetlerinde ve tartı girişinde kullanılır.</p>
      </Box>
      <Box title="Dokunuş ve ekran">
        <Seg testId="st-haptics" label="Titreşim" value={s.haptics} opts={[['off', 'Kapalı'], ['light', 'Hafif'], ['normal', 'Normal'], ['strong', 'Güçlü']]} onPick={(v) => save({ haptics: v })} />
        <Toggle testId="st-sound" label="Dokunuş sesi" hint="Kayıt eklenince kısa bir tık sesi." on={s.sound} onChange={(v) => save({ sound: v })} />
        <Toggle testId="st-warm" label="Akşam renkleri" hint="20.00–06.00 arası ekran sıcak tona döner, göz yorulmaz." on={s.warm} onChange={(v) => save({ warm: v })} />
      </Box>
      {msg ? <p role="status" className="text-[13px] font-bold text-ink-2 px-1">{msg}</p> : null}
    </div>
  )
}
