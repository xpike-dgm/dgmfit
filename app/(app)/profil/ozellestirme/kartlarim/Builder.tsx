'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { METRICS, PERIODS, type Metric, type Period, type UserCard, type View } from '@/lib/cards/custom'
import type { ScreenId } from '@/lib/cards/registry'
import type { UserCardData } from '@/lib/cards/custom-data'
import UserCardView from '@/components/cards/UserCardView'
import { shrinkImage } from '@/lib/client-image'
import { userCardAction } from '../actions'

type Kind = UserCard['kind']
const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: 'metric', label: 'Ölçüm', hint: 'Su, kalori, protein, kilo, antrenman' },
  { id: 'tracker', label: 'Takip alanım', hint: 'Kendi tanımladığın sayaç/ölçüm' },
  { id: 'quote', label: 'Söz', hint: 'Seni motive eden bir cümle' },
  { id: 'countdown', label: 'Geri sayım', hint: 'Yarışa, tatile, düğüne kalan gün' },
  { id: 'photo', label: 'Fotoğraf', hint: 'Hedef fotoğrafın (yalnız sen görürsün)' },
  { id: 'records', label: 'Rekorlarım', hint: 'En ağır 3 kaldırışın' },
]
const VIEWS: [View, string][] = [['number', 'Sayı'], ['bar', 'Çubuk (7 gün)'], ['spark', 'Çizgi']]
type Draft = { kind: Kind; screen: ScreenId; title: string; metric: Metric; period: Period; view: View; goal: string; trackerId: string; text: string; date: string; mediaId: string }

const empty = (trackers: { id: string }[]): Draft => ({ kind: 'metric', screen: 'today', title: '', metric: 'water', period: 'today', view: 'number', goal: '', trackerId: trackers[0]?.id ?? '', text: '', date: '', mediaId: '' })
const fromCard = (c: UserCard, trackers: { id: string }[]): Draft => ({ ...empty(trackers), ...c, goal: 'goal' in c && c.goal ? String(c.goal) : '' } as Draft)

export default function Builder({ cards, trackers, screens, edit }: { cards: { id: string; card: UserCard; placed: boolean }[]; trackers: { id: string; name: string; unit: string; emoji: string }[]; screens: { id: ScreenId; title: string; path: string }[]; edit: string | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const initial = cards.find((c) => c.id === edit)
  const [editing, setEditing] = useState<string | null>(initial?.id ?? null)
  const [d, setD] = useState<Draft>(initial ? fromCard(initial.card, trackers) : empty(trackers))
  const [msg, setMsg] = useState<string | null>(null)
  const [last, setLast] = useState<{ id: string; screen: ScreenId } | null>(null)
  const set = (p: Partial<Draft>) => setD({ ...d, ...p })
  const tr = trackers.find((t) => t.id === d.trackerId)
  const autoTitle = d.kind === 'metric' ? METRICS.find((m) => m.id === d.metric)!.label : d.kind === 'tracker' ? tr?.name ?? '' : d.kind === 'records' ? 'Rekorlarım' : d.kind === 'quote' ? 'Sözüm' : d.kind === 'countdown' ? 'Geri sayım' : 'Hedefim'
  const title = d.title.trim() || autoTitle
  const card = { kind: d.kind, screen: d.screen, title, metric: d.metric, period: d.period, view: d.view, goal: d.goal ? Number(d.goal.replace(',', '.')) : null, trackerId: d.trackerId, text: d.text, date: d.date, mediaId: d.mediaId }

  const preview: UserCardData = d.kind === 'quote' ? { kind: 'quote', title, text: d.text || 'Bugün dünden biraz daha iyi.' }
    : d.kind === 'countdown' ? { kind: 'countdown', title, date: d.date || '2027-01-01', days: d.date ? Math.round((Date.parse(d.date) - Date.now()) / 86_400_000) + 1 : 30 }
    : d.kind === 'photo' ? (d.mediaId ? { kind: 'photo', title, mediaId: d.mediaId } : { kind: 'quote', title, text: 'Fotoğraf seç' })
    : d.kind === 'records' ? { kind: 'records', title, records: [{ name: 'Squat', value: 100, type: 'weight' }, { name: 'Bench press', value: 70, type: 'weight' }] }
    : { kind: d.kind, title, unit: d.kind === 'tracker' ? tr?.unit ?? '' : METRICS.find((m) => m.id === d.metric)!.unit, value: 42, series: [3, 5, 4, 6, 5, 7, 6], goal: card.goal, view: d.view, periodLabel: PERIODS.find((p) => p.id === d.period)!.label }

  const save = () => start(async () => {
    const r = await userCardAction({ op: 'save', id: editing, card }).catch(() => null)
    if (!r?.ok) { setMsg(r && !r.ok ? r.error : 'Kaydedilemedi'); return }
    setMsg(editing ? 'Kart güncellendi' : `Kart ${screens.find((s) => s.id === d.screen)?.title} ekranına eklendi`)
    setLast({ id: r.id!, screen: d.screen }); setEditing(null); setD(empty(trackers)); router.refresh()
  })
  const del = (id: string, name: string) => { if (!confirm(`“${name}” kartı silinsin mi?`)) return; start(async () => { const r = await userCardAction({ op: 'delete', id }).catch(() => null); setMsg(r?.ok ? 'Kart silindi' : 'Silinemedi'); router.refresh() }) }
  const upload = async (f: File) => {
    setMsg('Fotoğraf yükleniyor…')
    const fd = new FormData(); fd.set('file', await shrinkImage(f, 1080, 0.82), 'motive.jpg'); fd.set('kind', 'motive')
    const r = await fetch('/api/media', { method: 'POST', body: fd }); const j = await r.json().catch(() => ({}))
    if (!r.ok || !j.id) { setMsg(j.error ?? 'Yüklenemedi'); return }
    setMsg(null); set({ mediaId: j.id })
  }
  const valid = title.length > 0 && (d.kind !== 'tracker' || !!d.trackerId) && (d.kind !== 'quote' || d.text.trim().length > 0) && (d.kind !== 'countdown' || /^\d{4}-\d{2}-\d{2}$/.test(d.date)) && (d.kind !== 'photo' || !!d.mediaId)
  const inp = 'h-11 rounded-xl px-3 bg-surface-2 border border-line text-[15px] w-full'
  const seg = (on: boolean) => `h-10 px-3 rounded-full border text-[13px] font-bold ${on ? 'bg-acc text-acc-ink border-acc' : 'border-line-2'}`
  const path = (s: ScreenId) => screens.find((x) => x.id === s)?.path ?? '/'

  return (
    <>
      {cards.length ? (
        <section aria-label="Kendi kartlarım" className="card px-4 py-1 flex flex-col" data-testid="my-cards">
          {cards.map(({ id, card: c, placed }) => (
            <div key={id} className="flex items-center gap-2 min-h-14 border-t border-line first:border-0 py-2" data-my-card={c.title}>
              <span className="flex-1 min-w-0 flex flex-col"><b className="text-[14.5px] truncate">{c.title}</b>
                <span className="text-[12px] text-mute">{KINDS.find((k) => k.id === c.kind)?.label} · {screens.find((s) => s.id === c.screen)?.title}{placed ? '' : ' · çekmecede'}</span></span>
              <Link href={`${path(c.screen)}${placed ? '' : '?duzenle=1'}`} className="h-9 px-3 rounded-full border border-line-2 text-[12.5px] font-bold inline-flex items-center">Gör</Link>
              <button type="button" onClick={() => { setEditing(id); setD(fromCard(c, trackers)); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="h-9 px-3 rounded-full border border-line-2 text-[12.5px] font-bold" aria-label={`${c.title} düzenle`}>Düzenle</button>
              <button type="button" onClick={() => del(id, c.title)} className="h-9 w-9 rounded-full border border-line-2 text-[14px] font-bold" aria-label={`${c.title} sil`}>×</button>
            </div>
          ))}
        </section>
      ) : null}

      <section className="card p-4 flex flex-col gap-3" aria-label={editing ? 'Kartı düzenle' : 'Yeni kart'} data-testid="builder-form">
        <b className="text-[15px]">{editing ? 'Kartı düzenle' : 'Yeni kart'}</b>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Kart türü">
          {KINDS.map((k) => (
            <button key={k.id} type="button" role="radio" aria-checked={d.kind === k.id} onClick={() => set({ kind: k.id, title: '' })} data-testid={`uc-kind-${k.id}`}
              className="text-left rounded-xl border border-line p-2.5 aria-checked:border-acc aria-checked:bg-acc/10"><b className="text-[13.5px] block">{k.label}</b><span className="text-[11.5px] text-mute leading-snug">{k.hint}</span></button>
          ))}
        </div>

        {d.kind === 'metric' ? (
          <label className="flex flex-col gap-1 text-[13px] font-bold">Veri<select className={inp} value={d.metric} onChange={(e) => set({ metric: e.target.value as Metric })} data-testid="uc-metric">{METRICS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
        ) : null}
        {d.kind === 'tracker' ? (trackers.length ? (
          <label className="flex flex-col gap-1 text-[13px] font-bold">Takip alanı<select className={inp} value={d.trackerId} onChange={(e) => set({ trackerId: e.target.value })} data-testid="uc-tracker">{trackers.map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}</select></label>
        ) : <p className="text-[13px] text-mute">Henüz takip alanın yok. <Link href="/profil/ozellestirme/takip" className="font-bold text-acc">Takip alanı ekle</Link></p>) : null}
        {d.kind === 'metric' || d.kind === 'tracker' ? <>
          <div className="flex flex-col gap-1.5"><span className="text-[13px] font-bold">Dönem</span><div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Dönem">{PERIODS.map((p) => <button key={p.id} type="button" role="radio" aria-checked={d.period === p.id} onClick={() => set({ period: p.id })} className={seg(d.period === p.id)}>{p.label}</button>)}</div></div>
          <div className="flex flex-col gap-1.5"><span className="text-[13px] font-bold">Görünüm</span><div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Görünüm">{VIEWS.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={d.view === v} onClick={() => set({ view: v })} className={seg(d.view === v)} data-testid={`uc-view-${v}`}>{l}</button>)}</div></div>
          {d.kind === 'metric' ? <label className="flex flex-col gap-1 text-[13px] font-bold">Hedef (isteğe bağlı)<input className={inp} value={d.goal} onChange={(e) => set({ goal: e.target.value })} inputMode="decimal" /></label> : null}
        </> : null}
        {d.kind === 'quote' ? <label className="flex flex-col gap-1 text-[13px] font-bold">Söz<textarea className={`${inp} h-20 py-2`} value={d.text} onChange={(e) => set({ text: e.target.value })} maxLength={160} data-testid="uc-text" /></label> : null}
        {d.kind === 'countdown' ? <label className="flex flex-col gap-1 text-[13px] font-bold">Tarih<input type="date" className={inp} value={d.date} onChange={(e) => set({ date: e.target.value })} data-testid="uc-date" /></label> : null}
        {d.kind === 'photo' ? <label className="h-11 rounded-full border border-line-2 font-bold text-[14px] inline-flex items-center justify-center cursor-pointer">{d.mediaId ? 'Fotoğrafı değiştir' : 'Fotoğraf seç'}<input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f) }} data-testid="uc-photo" /></label> : null}

        <label className="flex flex-col gap-1 text-[13px] font-bold">Kart adı<input className={inp} value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={30} placeholder={autoTitle} data-testid="uc-name" /></label>
        <label className="flex flex-col gap-1 text-[13px] font-bold">Ekran<select className={inp} value={d.screen} onChange={(e) => set({ screen: e.target.value as ScreenId })} data-testid="uc-screen">{screens.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>

        <div className="flex flex-col gap-1.5"><span className="text-[12px] font-bold text-mute">ÖNİZLEME (örnek değerler)</span><div className="pointer-events-none max-w-[220px] flex flex-col [&>*]:flex-1" aria-hidden data-testid="uc-preview"><UserCardView id="preview" data={preview} /></div></div>
        <div className="flex gap-2">
          {editing ? <button type="button" onClick={() => { setEditing(null); setD(empty(trackers)) }} className="h-12 px-4 rounded-full border border-line-2 font-bold">Vazgeç</button> : null}
          <button type="button" disabled={pending || !valid} onClick={save} className="flex-1 h-12 rounded-full bg-acc text-acc-ink font-extrabold disabled:opacity-50" data-testid="uc-save">{editing ? 'Kaydet' : 'Kartı ekle'}</button>
        </div>
        {msg ? <p className="text-[13px] text-ink-2" role="status" data-testid="uc-msg">{msg}{last ? <> · <Link href={path(last.screen)} className="font-bold text-acc">Ekranda gör</Link></> : null}</p> : null}
        <p className="text-[12px] text-mute leading-snug">Kartın rengini ekranda düzenleme modunda ✎ → Renkler ile değiştirebilirsin. Kendi kartların şablon paylaşırken çıkarılır (kişiseldir).</p>
      </section>
    </>
  )
}
