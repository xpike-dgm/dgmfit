'use client'
import { rirText } from '@/lib/training'
import Link from 'next/link'
import { useRef, useState } from 'react'
import BackButton from '@/components/BackButton'
import Sheet from '@/components/Sheet'
import { Check, Close, Heart, Pencil, Send } from '@/components/icons'
import { addToDayAction, favoriteAction, programDaysAction } from '../../anatomi/actions'

type Programs = { id: string; name: string; active: boolean; days: { id: string; name: string }[] }[]
interface P {
  id: number; name: string; trName: string | null; right: string | null; wrong: string | null; fav: boolean
  defaults: { sets: number; reps: number | null; seconds: number | null; rir: number } | null; rating: { avg: number; count: number } | null
}
const icon = 'w-12 h-12 flex items-center justify-center text-white drop-shadow active:scale-95 transition'

/** Lisanslı hareketin üst bölümü: arkada sessiz video (doğru/yanlış), sağda programa ekle · kaydet · paylaş, altta set/tekrar/RiR ve puan. */
export default function LicensedHero(p: P) {
  const [tab, setTab] = useState<'right' | 'wrong'>(p.right ? 'right' : 'wrong')
  const [fav, setFav] = useState(p.fav)
  const [picker, setPicker] = useState<Programs | null | 'loading'>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const src = tab === 'right' ? p.right : p.wrong
  const d = p.defaults
  const busy = useRef(false)
  const [vidErr, setVidErr] = useState(false)
  // kalp: iyimser güncelleme; hata/bağlantı yoksa geri alınır
  async function toggle() { if (busy.current) return; busy.current = true; const on = !fav; setFav(on); const r = await favoriteAction(p.id, on).catch(() => ({ ok: false as const, error: 'Bağlantı yok; tekrar dene.' })); busy.current = false; if (!r.ok) { setFav(!on); flash(r.error) } }
  async function openPicker() { setMsg(null); setPicker('loading'); const r = await programDaysAction().catch(() => ({ ok: false as const, error: 'Bağlantı yok; tekrar dene.' })); setPicker(r.ok ? r.programs : []) }
  async function add(dayId: string, name: string) { if (busy.current) return; busy.current = true; const r = await addToDayAction(dayId, p.id).catch(() => ({ ok: false as const, error: 'Bağlantı yok; tekrar dene.' })); busy.current = false; setMsg(r.ok ? `“${name}” gününe eklendi` : r.error) }
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg((m) => (m === t ? null : m)), 2500) }
  async function share() {
    const url = location.href
    try { if (navigator.share) await navigator.share({ title: p.name, url }); else { await navigator.clipboard.writeText(url); flash('Bağlantı kopyalandı') } } catch { /* iptal */ }
  }
  return (
    <section className="relative -mx-4 -mt-[env(safe-area-inset-top)] h-[78dvh] min-h-[460px] bg-black text-white overflow-hidden" data-testid="ex-videos">
      {src && !vidErr ? <video key={src} src={src} onError={() => setVidErr(true)} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline preload="auto" aria-label={`${p.name} · ${tab === 'right' ? 'doğru' : 'yanlış'} yapılış`} data-testid="ex-video" />
        : <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-[14px] text-white/70" data-testid="ex-video-missing">Bu hareketin videosu şu an gösterilemiyor.</p>}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/85 pointer-events-none" />
      <header className="absolute top-0 left-0 right-0 safe-top px-3 flex items-center gap-2">
        <BackButton fallback="/fitness/hareketler" className="w-11 h-11 rounded-full flex items-center justify-center text-white" />
        <div className="flex-1 min-w-0 text-center pr-11">
          <h1 className="text-[19px] font-extrabold leading-tight truncate">{p.name}</h1>
          {p.trName ? <p className="text-[12.5px] text-white/70 truncate" data-testid="ex-tr-name">Türkçe: {p.trName}</p> : null}
        </div>
      </header>
      {p.right && p.wrong ? (
        <div className="absolute top-[calc(env(safe-area-inset-top)+64px)] inset-x-0 mx-auto w-fit flex gap-2 p-1 rounded-full bg-black/45 backdrop-blur" role="tablist" aria-label="Video">
          {([['right', 'Doğru yapılış', '#2F8A3A'], ['wrong', 'Yanlış yapılış', '#E53935']] as const).map(([k, l, c]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} aria-label={l} title={l} onClick={() => { setTab(k); setVidErr(false) }}
              className="w-10 h-10 rounded-full flex items-center justify-center transition" style={tab === k ? { background: c, color: '#fff' } : { color: c }}>
              {k === 'right' ? <Check size={22} /> : <Close size={20} />}
            </button>
          ))}
        </div>
      ) : null}
      <div className="absolute right-3 bottom-36 flex flex-col gap-3">
        <button type="button" className={icon} aria-label="Programa ekle" onClick={openPicker} data-testid="hero-add"><Pencil size={30} /></button>
        <button type="button" className={`${icon} ${fav ? 'text-[#E53935]' : ''}`} aria-label={fav ? 'Kaydedilenlerden çıkar' : 'Kaydet'} aria-pressed={fav} onClick={toggle} data-testid="hero-fav"><Heart size={32} filled={fav} /></button>
        <button type="button" className={icon} aria-label="Paylaş" onClick={share}><Send size={30} className="rotate-45" /></button>
      </div>
      <div className="absolute left-0 right-0 bottom-0 px-5 pb-6 flex items-end justify-between gap-3">
        {d ? (
          <dl className="flex gap-6" data-testid="hero-defaults">
            <div><dd className="num text-[26px] font-bold leading-none">{d.sets}</dd><dt className="text-[17px] mt-1">Set</dt></div>
            <div><dd className="num text-[26px] font-bold leading-none">{d.reps ?? `${d.seconds}`}</dd><dt className="text-[17px] mt-1">{d.reps ? 'Tekrar' : 'Saniye'}</dt></div>
            <div><dd className="num text-[26px] font-bold leading-none">{rirText(d.rir)}</dd><dt className="text-[17px] mt-1">RiR</dt></div>
          </dl>
        ) : <span />}
        {p.rating ? <span className="h-12 px-4 rounded-full bg-black/55 flex items-center gap-1.5 num text-[17px] font-bold" aria-label={`Puan ${p.rating.avg}`}>{String(p.rating.avg).replace('.', ',')} <span className="text-[#F5B83D]">★</span></span> : null}
      </div>
      {msg ? <p role="status" className="absolute left-4 right-4 bottom-28 text-center text-[14px] font-semibold bg-black/60 rounded-xl py-2">{msg}</p> : null}
      <Sheet open={picker !== null} onClose={() => setPicker(null)} title="Antrenman seç">
        <div className="flex flex-col gap-2 pb-4" data-testid="day-picker-sheet">
          {picker === 'loading' ? <p className="text-[14px] text-mute">Yükleniyor…</p>
            : !picker?.length ? <p className="text-[14px] text-mute">Henüz programın yok. <Link href="/fitness/programlar" className="text-acc font-bold">Program oluştur</Link></p>
              : picker.map((g) => (
                <div key={g.id} className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold text-mute uppercase tracking-[0.06em]">{g.name}{g.active ? ' · aktif' : ''}</span>
                  {g.days.map((dd) => <button key={dd.id} type="button" onClick={() => add(dd.id, dd.name)} className="h-12 px-4 rounded-2xl bg-surface-2 border border-line text-left font-semibold">{dd.name}</button>)}
                </div>
              ))}
          {msg ? <p role="status" className="text-[14px] font-semibold text-good">{msg}</p> : null}
        </div>
      </Sheet>
    </section>
  )
}
