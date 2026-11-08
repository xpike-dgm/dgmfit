'use client'
import MiniPreview from '@/components/cards/MiniPreview'
import type { Design } from '@/lib/cards/layout'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { fmtNum } from '@/lib/calc'
import { MEAL_LABEL, type MealId } from '@/lib/food'
import { POST_KINDS, REACTIONS, type Reaction } from '@/lib/social'
import type { PostView } from '@/lib/social-data'
import { Bookmark, Chat, Smile } from '@/components/icons'
import { addRecipeMealAction, copyWorkoutAction, saveProgramAction, deletePostAction, friendAction, reactAction, reportAction, saveAction, saveRecipeAction } from '@/app/(app)/sosyal/actions'
import { ask } from '@/components/Confirm'

export function Avatar({ src, name, size = 40 }: { src: string | null; name: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" width={size} height={size} className="rounded-full object-cover bg-surface-2 shrink-0" style={{ width: size, height: size }} />
    : <span className="rounded-full bg-surface-3 text-ink font-bold flex items-center justify-center shrink-0 uppercase" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden>{name.slice(0, 1)}</span>
}
const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (m < 1) return 'şimdi'
  if (m < 60) return `${m} dk`
  if (m < 1440) return `${Math.round(m / 60)} sa`
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}
const AUD: Record<string, string> = { public: 'Herkese açık', friends: 'Arkadaşlar', selected: 'Seçilenler' }
type W = { name: string; minutes: number; volumeKg: number; workSets: number; exercises: { name: string; kind: string; sets: { kg: number; reps: number; seconds: number | null }[] }[]; prs: { name: string; type: string; value: number }[] }

function Body({ p, onMsg }: { p: PostView; onMsg: (m: string) => void }) {
  const d = p.data as Record<string, unknown>
  const [pending, start] = useTransition()
  const [meal, setMeal] = useState<MealId>('dinner')
  const router = useRouter()
  if (p.kind === 'workout') {
    const w = d as unknown as W
    return (
      <div className="rounded-2xl bg-surface-2 px-3.5 py-3 flex flex-col gap-2" data-testid="post-workout">
        <div className="flex justify-between text-[13px]"><b>{w.name}</b><span className="text-mute num">{w.minutes} dk · {fmtNum(w.volumeKg)} kg · {w.workSets} set</span></div>
        <ul className="flex flex-col gap-0.5 text-[13px]">{w.exercises.map((e, i) => <li key={i} className="flex justify-between gap-2"><span>{e.name}</span><span className="num text-ink-2 text-right">{e.sets.map((s) => (e.kind === 'time' ? `${s.seconds ?? 0} sn` : s.kg ? `${fmtNum(s.kg, 1)}×${s.reps}` : `${s.reps}`)).join(' · ')}</span></li>)}</ul>
        {w.prs?.length ? <span className="text-[12px] text-acc">🏆 {w.prs.length} rekor</span> : null}
        {!p.mine ? <button type="button" className="self-start h-9 px-3 rounded-full bg-acc text-acc-ink text-[12px] font-bold" disabled={pending}
          onClick={() => start(async () => { const r = await copyWorkoutAction(p.id); if (r.ok) router.push(`/fitness/programlar/${r.id}`); else onMsg(r.error) })}>Bu antrenmanı kopyala</button> : null}
      </div>
    )
  }
  if (p.kind === 'pr') return <div className="rounded-2xl bg-coach border border-coach-line px-3.5 py-3 text-[15px]" data-testid="post-pr">🏆 <b>{String(d.name)}</b> · {String(d.label)}: <b className="num">{fmtNum(Number(d.value), 1)}{d.type === 'reps' ? ' tekrar' : ' kg'}</b>{d.previous ? <span className="text-mute"> (önceki {fmtNum(Number(d.previous), 1)})</span> : null}</div>
  if (p.kind === 'design') {
    const g = d as { templateId: string; name: string; design: Design }
    return (
      <Link href={`/profil/ozellestirme/sablonlar/${g.templateId}`} className="rounded-2xl bg-surface-2 px-3.5 py-3 flex items-center gap-3" data-testid="post-design">
        <MiniPreview design={g.design} width={64} label={`${g.name} önizlemesi`} />
        <span className="flex flex-col gap-1 min-w-0"><span className="text-[11px] font-extrabold text-mute tracking-[0.06em]">TASARIM ŞABLONU</span><b className="truncate">{g.name}</b><span className="text-[13px] text-acc font-bold">Önizle ve kullan ›</span></span>
      </Link>
    )
  }
  if (p.kind === 'program') {
    const g = d as { name: string; days: { name: string; focus: string; exercises: { name: string; sets: number; repMin: number; repMax: number; seconds: number | null }[] }[] }
    return (
      <div className="rounded-2xl bg-surface-2 px-3.5 py-3 flex flex-col gap-2" data-testid="post-program">
        <div className="flex justify-between gap-2"><b className="min-w-0 truncate">{g.name}</b><span className="text-[13px] text-mute num shrink-0">{g.days.length} gün · {g.days.reduce((a, x) => a + x.exercises.length, 0)} hareket</span></div>
        <details className="text-[13px]">
          <summary className="cursor-pointer text-ink-2 font-semibold">{g.days.map((x) => x.name).join(' · ')}</summary>
          <div className="flex flex-col gap-2 mt-2">
            {g.days.map((x, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <b className="text-[12.5px]">{x.name}{x.focus ? <span className="text-mute font-normal"> · {x.focus}</span> : null}</b>
                {x.exercises.map((e, j) => <span key={j} className="flex justify-between gap-2 text-ink-2"><span className="truncate">{e.name}</span><span className="num shrink-0">{e.sets} × {e.seconds ? `${e.seconds} sn` : e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`}</span></span>)}
              </div>
            ))}
          </div>
        </details>
        {!p.mine ? <button type="button" className="self-start h-9 px-3 rounded-full bg-acc text-acc-ink text-[12px] font-bold" disabled={pending}
          onClick={() => start(async () => { const r = await saveProgramAction(p.id); if (r.ok) router.push(`/fitness/programlar/${r.id}`); else onMsg(r.error) })}>Programlarıma kaydet</button> : null}
      </div>
    )
  }
  if (p.kind === 'recipe') {
    const r = d as { name: string; per100: Record<string, number>; portions: { label: string; g: number }[]; recipe: { ingredients?: { name: string; g: number }[] } | null }
    const g = r.portions?.[0]?.g ?? 100
    return (
      <div className="rounded-2xl bg-surface-2 px-3.5 py-3 flex flex-col gap-2" data-testid="post-recipe">
        <div className="flex justify-between"><b>{r.name}</b><span className="num text-[13px] text-mute">{r.portions?.[0]?.label ?? '100 g'} · {fmtNum(Math.round(((r.per100.kcal ?? 0) * g) / 100))} kcal</span></div>
        {r.recipe?.ingredients?.length ? <p className="text-[12px] text-ink-2">{r.recipe.ingredients.map((x) => `${x.name} ${fmtNum(x.g)} g`).join(', ')}</p> : null}
        {!p.mine ? (
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" className="h-9 px-3 rounded-full border border-line-2 text-[12px] font-bold" disabled={pending} onClick={() => start(async () => { const x = await saveRecipeAction(p.id); onMsg(x.ok ? 'Tariflerine kaydedildi' : x.error) })}>Tariflerime kaydet</button>
            <select aria-label="Öğün" value={meal} onChange={(e) => setMeal(e.target.value as MealId)} className="h-9 rounded-full bg-surface border border-line px-2 text-[12px]">{(Object.keys(MEAL_LABEL) as MealId[]).map((k) => <option key={k} value={k}>{MEAL_LABEL[k]}</option>)}</select>
            <button type="button" className="h-9 px-3 rounded-full bg-acc text-acc-ink text-[12px] font-bold" disabled={pending} onClick={() => start(async () => { const x = await addRecipeMealAction(p.id, meal); onMsg(x.ok ? `Öğün olarak eklendi · ${fmtNum(x.kcal)} kcal` : x.error) })}>Öğün olarak ekle</button>
          </div>
        ) : null}
      </div>
    )
  }
  if (p.kind === 'meal') {
    const m = d as { label: string; items: { name: string; grams: number; kcal: number }[]; kcal: number; protein: number }
    return <div className="rounded-2xl bg-surface-2 px-3.5 py-3 flex flex-col gap-1 text-[13px]" data-testid="post-meal"><b>{m.label} · <span className="num">{fmtNum(m.kcal)} kcal, {fmtNum(m.protein)} g protein</span></b>{m.items.map((x, i) => <span key={i} className="text-ink-2">{x.name} · {fmtNum(x.grams)} g</span>)}</div>
  }
  if (p.kind === 'streak') return <div className="rounded-2xl bg-surface-2 px-3.5 py-3 text-[15px]" data-testid="post-streak">💧 <b className="num">{String(d.streak)}</b> {String(d.label)}</div>
  if (p.kind === 'badge') return <div className="rounded-2xl bg-coach border border-coach-line px-3.5 py-3 flex flex-col gap-0.5" data-testid="post-badge"><b className="text-[15px]">🏅 {String(d.title)}</b><span className="text-[13px] text-mute">{String(d.desc)}</span></div>
  if (p.kind === 'milestone') return <div className="rounded-2xl bg-coach border border-coach-line px-3.5 py-3 text-[15px]" data-testid="post-milestone">🎯 <b>{String(d.text)}</b></div>
  return null
}

export default function PostCard({ p, detail = false }: { p: PostView; detail?: boolean }) {
  const [mine, setMine] = useState<string | null>(p.myReaction)
  const [counts, setCounts] = useState(p.reactions)
  const [saved, setSaved] = useState(p.saved)
  const [menu, setMenu] = useState(false)
  const [pick, setPick] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [gone, setGone] = useState(false)
  const router = useRouter()
  if (gone) return null
  const tap = async (k: Reaction) => {
    const next = mine === k ? null : k
    const c = { ...counts }
    if (mine) c[mine] = Math.max(0, (c[mine] ?? 1) - 1)
    if (next) c[next] = (c[next] ?? 0) + 1
    setCounts(c); setMine(next)
    const r = await reactAction(p.id, next)
    if (!r.ok) setMsg(r.error)
  }
  return (
    <article className="card p-4 flex flex-col gap-3" data-testid="post" data-kind={p.kind} data-id={p.id}>
      <header className="flex items-center gap-3">
        <Link href={`/u/${p.author.username}`} className="flex items-center gap-3 min-w-0 flex-1">
          <Avatar src={p.author.avatar} name={p.author.username} />
          <span className="flex flex-col min-w-0"><b className="truncate">{p.author.username}</b><span className="text-[12px] text-mute">{POST_KINDS[p.kind as keyof typeof POST_KINDS] ?? ''} · {ago(p.createdAt)} · {AUD[p.audience]}</span></span>
        </Link>
        <button type="button" aria-label="Gönderi menüsü" aria-expanded={menu} onClick={() => setMenu(!menu)} className="w-10 h-10 rounded-full text-mute text-xl">⋯</button>
      </header>
      {menu ? (
        <div className="flex flex-wrap gap-2 -mt-1" role="menu">
          <Link href={`/sosyal/mesaj?paylas=${p.id}`} role="menuitem" className="h-9 px-3 rounded-full border border-line-2 text-[12px] font-bold inline-flex items-center">Mesajla gönder</Link>
          {p.mine ? <button type="button" role="menuitem" className="h-9 px-3 rounded-full border border-line-2 text-[12px] font-bold text-danger" onClick={async () => { if (!(await ask('Gönderi silinsin mi?'))) return; await deletePostAction(p.id); setGone(true); router.refresh() }}>Sil</button> : (
            <>
              {(['taciz', 'uygunsuz', 'zararlı diyet', 'spam'] as const).map((r) => <button key={r} type="button" role="menuitem" className="h-9 px-3 rounded-full border border-line-2 text-[12px] font-bold" onClick={async () => { const x = await reportAction({ targetType: 'post', targetId: p.id, reason: r }); setMsg(x.ok ? 'Şikayetin alındı, teşekkürler.' : x.error); setMenu(false) }}>Şikayet: {r}</button>)}
              <button type="button" role="menuitem" className="h-9 px-3 rounded-full border border-line-2 text-[12px] font-bold" onClick={async () => { await friendAction({ op: 'mute', id: p.author.id }); setGone(true) }}>Sessize al</button>
            </>
          )}
        </div>
      ) : null}
      {p.moderation !== 'ok' ? <p className="text-[12px] text-orange" data-testid="post-pending">{p.moderation === 'pending' ? 'İnceleme bekliyor: şimdilik yalnızca sen görüyorsun.' : 'Topluluk kurallarına uymadığı için gizlendi; yalnızca sen görüyorsun.'}</p> : null}
      {p.body ? <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{p.body}</p> : null}
      <Body p={p} onMsg={setMsg} />
      {p.media.length ? (
        <div className={`grid gap-1.5 ${p.media.length > 1 ? 'grid-cols-2' : ''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.media.map((m, i) => <img key={i} src={m} alt={`Fotoğraf ${i + 1}`} className="w-full rounded-2xl object-cover bg-surface-2 aspect-square" loading="lazy" />)}
        </div>
      ) : null}
      <footer className="flex items-center gap-1.5 flex-wrap">
        {/* kullanılmış tepkiler sayılarıyla; tümü "Tepki ver" ile açılır */}
        {(pick ? (Object.keys(REACTIONS) as Reaction[]) : (Object.keys(REACTIONS) as Reaction[]).filter((k) => counts[k] || mine === k)).map((k) => (
          <button key={k} type="button" aria-pressed={mine === k} aria-label={`Tepki ${REACTIONS[k]}`} onClick={() => { setPick(false); void tap(k) }}
            className={`h-9 px-2.5 rounded-full text-[14px] flex items-center gap-1 ${mine === k ? 'bg-acc/20 border border-acc' : 'bg-surface-2'}`}>{REACTIONS[k]}{counts[k] ? <span className="num text-[12px]">{counts[k]}</span> : null}</button>
        ))}
        {!pick ? <button type="button" aria-label="Tepki ver" aria-expanded={false} onClick={() => setPick(true)} className="h-9 w-9 rounded-full bg-surface-2 text-mute flex items-center justify-center" data-testid="react-open"><Smile size={18} /></button> : null}
        {!detail ? <Link href={`/sosyal/p/${p.id}`} aria-label={`Yorumlar (${p.comments})`} className="h-9 px-3 rounded-full bg-surface-2 text-[13px] font-semibold inline-flex items-center gap-1.5" data-testid="post-comments"><Chat size={16} />{p.comments}</Link> : null}
        <button type="button" aria-pressed={saved} aria-label={saved ? 'Kaydedilenlerden çıkar' : 'Gönderiyi kaydet'} onClick={async () => { setSaved(!saved); await saveAction(p.id, !saved) }} className={`ml-auto h-9 w-9 rounded-full flex items-center justify-center ${saved ? 'text-acc' : 'text-mute'}`}><Bookmark size={19} filled={saved} /></button>
      </footer>
      {msg ? <p role="status" className="text-[13px] text-acc">{msg}</p> : null}
    </article>
  )
}
