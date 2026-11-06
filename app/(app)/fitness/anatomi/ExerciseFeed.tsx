'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import BodyFigure from '@/components/BodyFigure'
import BackButton from '@/components/BackButton'
import Sheet from '@/components/Sheet'
import { Close, Heart } from '@/components/icons'
import { LEVEL_COLOR, activationLevel, bestSide, cropFor, viewKey, type Gender } from '@/lib/anatomy'
import type { AnatomyView, FeedItem } from '@/lib/anatomy-data'
import { addToDayAction, favoriteAction, programDaysAction } from './actions'

type Programs = { id: string; name: string; active: boolean; days: { id: string; name: string }[] }[]

/** Tam ekran dikey hareket akışı: arkada sessiz döngülü video, aşağı kaydırınca sıradaki hareket. */
export default function ExerciseFeed({ title, items, views, gender, back, empty }: { title: string; items: FeedItem[]; views: Record<string, AnatomyView>; gender: Gender; back: string; empty?: string }) {
  const [favs, setFavs] = useState(() => new Set(items.filter((i) => i.fav).map((i) => i.id)))
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null)
  const [picker, setPicker] = useState<{ id: number; programs: Programs | null } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)

  // Görünen video oynar, diğerleri durur (veri ve pil için)
  useEffect(() => {
    const vids = [...(root.current?.querySelectorAll('video') ?? [])]
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const v = e.target as HTMLVideoElement
      if (e.isIntersecting && e.intersectionRatio > 0.6) { if (v.preload === 'none') v.preload = 'auto'; v.play().catch(() => {}) } else v.pause()
    }), { root: root.current, threshold: [0, 0.6, 1] })
    vids.forEach((v) => io.observe(v))
    return () => io.disconnect()
  }, [items])

  const busy = useRef(false)
  async function toggleFav(id: number) {
    if (busy.current) return
    busy.current = true
    const on = !favs.has(id)
    setFavs((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n })
    const r = await favoriteAction(id, on).catch(() => ({ ok: false as const, error: 'Bağlantı yok; tekrar dene.' }))
    busy.current = false
    if (!r.ok) { setFavs((s) => { const n = new Set(s); if (on) n.delete(id); else n.add(id); return n }); setToast({ id, text: r.error }); return }
    setToast(on ? { id, text: 'Hareket kaydedilenlere eklendi!' } : null)
  }
  async function openPicker(id: number) {
    setToast(null); setMsg(null); setPicker({ id, programs: null })
    const r = await programDaysAction().catch(() => ({ ok: false as const, error: 'Bağlantı yok; tekrar dene.' }))
    setPicker({ id, programs: r.ok ? r.programs : [] })
  }
  async function add(dayId: string, dayName: string) {
    if (!picker || busy.current) return
    busy.current = true
    const r = await addToDayAction(dayId, picker.id).catch(() => ({ ok: false as const, error: 'Bağlantı yok; tekrar dene.' }))
    busy.current = false
    setMsg(r.ok ? `“${dayName}” gününe eklendi` : r.error)
  }

  return (
    <div className="fixed inset-0 z-30 bg-black text-white" data-testid="exercise-feed">
      <header className="absolute top-0 left-0 right-0 z-20 safe-top px-3 pb-2 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <BackButton fallback={back} className="w-11 h-11 rounded-full flex items-center justify-center text-white pointer-events-auto" />
        <h1 className="flex-1 text-center text-[19px] font-extrabold truncate pr-11">{title}</h1>
      </header>
      {toast ? (
        <div className="absolute z-30 left-3 right-3 top-16 safe-top rounded-2xl bg-[#1C1F26] border border-white/10 p-3 flex items-center gap-2 shadow-xl" role="status">
          <div className="flex-1 text-center"><p className="text-[14.5px]">{toast.text}</p><button type="button" className="text-[15px] font-bold text-[#FF6B57] mt-1" onClick={() => openPicker(toast.id)}>Antrenman Seç</button></div>
          <button type="button" aria-label="Kapat" className="w-9 h-9 flex items-center justify-center" onClick={() => setToast(null)}><Close size={20} /></button>
        </div>
      ) : null}
      {items.length ? (
        <div ref={root} className="h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar overscroll-contain">
          {items.map((it, i) => {
            const fills = Object.fromEntries(Object.entries(it.muscles).filter(([, r]) => r >= 2).map(([k, r]) => [k, LEVEL_COLOR[activationLevel(r)]]))
            const keys = Object.entries(it.muscles).filter(([, r]) => r >= 6).map(([k]) => k)
            const fig = views[viewKey(gender, bestSide(it.muscles))]
            return (
              <section key={it.id} className="relative h-full w-full snap-start snap-always overflow-hidden" data-testid="feed-item" data-name={it.name}>
                {it.video ? <video src={it.video} className="absolute inset-0 w-full h-full object-cover" muted loop playsInline preload={i === 0 ? 'auto' : 'none'} aria-hidden /> : <div className="absolute inset-0 bg-[#1C1F26]" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent pointer-events-none" />
                <div className="absolute left-0 right-0 bottom-0 px-5 pb-[max(28px,env(safe-area-inset-bottom))] flex flex-col gap-3">
                  {fig ? <BodyFigure view={fig} fills={fills} crop={cropFor(keys.length ? keys : Object.keys(it.muscles))} className="w-36 h-auto -ml-3 drop-shadow-xl" label={`${it.name} çalışan kaslar`} /> : null}
                  <div className="flex items-end gap-3">
                    <h2 className="flex-1 text-[30px] leading-[1.05] font-extrabold drop-shadow">{it.name}</h2>
                    <button type="button" onClick={() => toggleFav(it.id)} aria-pressed={favs.has(it.id)} aria-label={favs.has(it.id) ? 'Kaydedilenlerden çıkar' : 'Kaydet'} className={`w-12 h-12 flex items-center justify-center ${favs.has(it.id) ? 'text-[#E53935]' : 'text-white'}`} data-testid="fav"><Heart size={34} filled={favs.has(it.id)} /></button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/fitness/hareketler/${it.id}`} className="h-12 px-6 rounded-xl bg-[#E53935] text-white font-bold text-[16px] flex items-center" data-testid="feed-detail">Detayları Gör</Link>
                    {it.rating ? <span className="h-11 px-4 rounded-full bg-black/55 flex items-center gap-1.5 num text-[16px] font-bold" aria-label={`Puan ${it.rating.avg}, ${it.rating.count} oy`}>{String(it.rating.avg).replace('.', ',')} <span className="text-[#F5B83D]">★</span></span> : null}
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      ) : <div className="h-full flex items-center justify-center px-8 text-center text-white/70">{empty ?? 'Hareket bulunamadı.'}</div>}
      <Sheet open={!!picker} onClose={() => setPicker(null)} title="Antrenman seç">
        <div className="flex flex-col gap-2 pb-4" data-testid="day-picker-sheet">
          {!picker?.programs ? <p className="text-[14px] text-mute">Yükleniyor…</p>
            : !picker.programs.length ? <p className="text-[14px] text-mute">Henüz programın yok. <Link href="/fitness/programlar" className="text-acc font-bold">Program oluştur</Link></p>
              : picker.programs.map((p) => (
                <div key={p.id} className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold text-mute uppercase tracking-[0.06em]">{p.name}{p.active ? ' · aktif' : ''}</span>
                  {p.days.map((d) => <button key={d.id} type="button" onClick={() => add(d.id, d.name)} className="h-12 px-4 rounded-2xl bg-surface-2 border border-line text-left font-semibold">{d.name}</button>)}
                </div>
              ))}
          {msg ? <p role="status" className="text-[14px] font-semibold text-good">{msg}</p> : null}
        </div>
      </Sheet>
    </div>
  )
}
