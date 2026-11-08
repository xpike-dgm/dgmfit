'use client'
// G1: Kendi kartlarım — kart listesi (simge, tür, ekran; dokun → düzenle) + "Yeni kart" alt penceresi:
// üstte canlı önizleme, tür kutuları, seçenekler çip/segment olarak (açılır liste yok), ekran çipleri, sabit Kaydet.
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { METRICS, PERIODS, type Metric, type Period, type UserCard, type View } from '@/lib/cards/custom'
import type { ScreenId } from '@/lib/cards/registry'
import type { UserCardData } from '@/lib/cards/custom-data'
import UserCardView from '@/components/cards/UserCardView'
import Sheet from '@/components/Sheet'
import { Group, Ico, IconBox, Row, chipClass, segClass, type IconName } from '@/components/cards/StudioUI'
import { shrinkImage } from '@/lib/client-image'
import { userCardAction } from '../actions'
import { ask } from '@/components/Confirm'

type Kind = UserCard['kind']
const KINDS: { id: Kind; label: string; hint: string; icon: IconName; mod: string }[] = [
  { id: 'metric', label: 'Ölçüm', hint: 'Su, kalori, kilo…', icon: 'chart', mod: 'water' },
  { id: 'tracker', label: 'Takip alanım', hint: 'Kendi sayacın', icon: 'tracker', mod: 'plan' },
  { id: 'quote', label: 'Söz', hint: 'Motive eden cümle', icon: 'quote', mod: 'coach' },
  { id: 'countdown', label: 'Geri sayım', hint: 'Kalan gün', icon: 'timer', mod: 'food' },
  { id: 'photo', label: 'Fotoğraf', hint: 'Hedef fotoğrafın', icon: 'photo', mod: 'social' },
  { id: 'records', label: 'Rekorlarım', hint: 'En ağır 3 kaldırış', icon: 'trophy', mod: 'fitness' },
]
const VIEWS: [View, string][] = [['number', 'Sayı'], ['bar', 'Çubuk'], ['spark', 'Çizgi']]
type Draft = { kind: Kind; screen: ScreenId; title: string; metric: Metric; period: Period; view: View; goal: string; trackerId: string; text: string; date: string; mediaId: string }

const empty = (trackers: { id: string }[]): Draft => ({ kind: 'metric', screen: 'today', title: '', metric: 'water', period: 'today', view: 'number', goal: '', trackerId: trackers[0]?.id ?? '', text: '', date: '', mediaId: '' })
const fromCard = (c: UserCard, trackers: { id: string }[]): Draft => ({ ...empty(trackers), ...c, goal: 'goal' in c && c.goal ? String(c.goal) : '' } as Draft)

export default function Builder({ cards, trackers, screens, edit }: { cards: { id: string; card: UserCard; placed: boolean }[]; trackers: { id: string; name: string; unit: string; emoji: string }[]; screens: { id: ScreenId; title: string; path: string }[]; edit: string | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const initial = cards.find((c) => c.id === edit)
  const [open, setOpen] = useState(!!initial)
  const [editing, setEditing] = useState<string | null>(initial?.id ?? null)
  const [d, setD] = useState<Draft>(initial ? fromCard(initial.card, trackers) : empty(trackers))
  const [msg, setMsg] = useState<string | null>(null)
  const [formMsg, setFormMsg] = useState<string | null>(null)
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

  const openNew = () => { setEditing(null); setD(empty(trackers)); setFormMsg(null); setOpen(true) }
  const openEdit = (id: string, c: UserCard) => { setEditing(id); setD(fromCard(c, trackers)); setFormMsg(null); setOpen(true) }
  const save = () => start(async () => {
    const r = await userCardAction({ op: 'save', id: editing, card }).catch(() => null)
    if (!r?.ok) { setFormMsg(r && !r.ok ? r.error : 'Kaydedilemedi'); return }
    setMsg(editing ? 'Kart güncellendi' : `Kart ${screens.find((s) => s.id === d.screen)?.title} ekranına eklendi`)
    setLast({ id: r.id!, screen: d.screen }); setOpen(false); setEditing(null); setD(empty(trackers)); router.refresh()
  })
  const del = async (id: string, name: string) => { if (!(await ask(`“${name}” kartı silinsin mi?`))) return; start(async () => { const r = await userCardAction({ op: 'delete', id }).catch(() => null); setMsg(r?.ok ? 'Kart silindi' : 'Silinemedi'); router.refresh() }) }
  const upload = async (f: File) => {
    setFormMsg('Fotoğraf yükleniyor…')
    const fd = new FormData(); fd.set('file', await shrinkImage(f, 1080, 0.82), 'motive.jpg'); fd.set('kind', 'motive')
    const r = await fetch('/api/media', { method: 'POST', body: fd }); const j = await r.json().catch(() => ({}))
    if (!r.ok || !j.id) { setFormMsg(j.error ?? 'Yüklenemedi'); return }
    setFormMsg(null); set({ mediaId: j.id })
  }
  const valid = title.length > 0 && (d.kind !== 'tracker' || !!d.trackerId) && (d.kind !== 'quote' || d.text.trim().length > 0) && (d.kind !== 'countdown' || /^\d{4}-\d{2}-\d{2}$/.test(d.date)) && (d.kind !== 'photo' || !!d.mediaId)
  const inp = 'h-12 rounded-[14px] px-3.5 bg-surface-2 border border-line text-[15px] w-full outline-none focus:border-acc'
  const path = (s: ScreenId) => screens.find((x) => x.id === s)?.path ?? '/'
  const label = (t: string) => <span className="text-[12px] font-bold tracking-[0.04em] uppercase text-mute">{t}</span>

  return (
    <>
      <button type="button" onClick={openNew} className="min-h-14 rounded-[20px] bg-acc text-acc-ink font-extrabold text-[15px] inline-flex items-center justify-center gap-2 active:scale-[0.99] transition" data-testid="uc-new">
        <Ico name="plus" size={20} />Yeni kart oluştur
      </button>
      {msg ? <p className="text-[13px] font-bold text-ink-2 px-1 -mt-1" role="status" data-testid="uc-msg">{msg}{last ? <> · <Link href={path(last.screen)} className="text-acc">Ekranda gör</Link></> : null}</p> : null}

      {cards.length ? (
        <Group label={`Kartların · ${cards.length}`} testId="my-cards">
          {cards.map(({ id, card: c, placed }) => {
            const k = KINDS.find((x) => x.id === c.kind)!
            return (
              <div key={id} className="flex items-center gap-1 pr-2" data-my-card={c.title}>
                <div className="flex-1 min-w-0">
                  <Row onClick={() => openEdit(id, c)} icon={k.icon} mod={k.mod} title={c.title} chevron={false}
                    sub={<>{k.label} · {screens.find((s) => s.id === c.screen)?.title}{placed ? '' : <span className="text-orange"> · çekmecede</span>}</>} />
                </div>
                <Link href={`${path(c.screen)}${placed ? '' : '?duzenle=1'}`} aria-label={`${c.title} ekranda gör`} className="w-10 h-10 rounded-full bg-surface-2 text-ink-2 flex items-center justify-center shrink-0"><Ico name="eye" size={18} /></Link>
                <button type="button" onClick={() => del(id, c.title)} aria-label={`${c.title} sil`} className="w-10 h-10 rounded-full bg-surface-2 text-danger flex items-center justify-center shrink-0"><Ico name="trash" size={17} /></button>
              </div>
            )
          })}
        </Group>
      ) : (
        <div className="card rounded-[22px] p-5 flex flex-col items-center text-center gap-2" data-testid="my-cards-empty">
          <IconBox name="chart" mod="food" size="lg" />
          <b className="text-[15px]">Henüz kendi kartın yok</b>
          <span className="text-[13px] text-mute leading-snug max-w-[280px]">Su, kalori, kilo ya da kendi takip alanın için bir kart yap; söz, geri sayım ve hedef fotoğrafı da olur.</span>
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={editing ? 'Kartı düzenle' : 'Yeni kart'}>
        <div className="flex flex-col gap-4" aria-label={editing ? 'Kartı düzenle' : 'Yeni kart'} data-testid="builder-form" data-mod="today">
          <div className="-mx-5 px-5 py-4 bg-[repeating-conic-gradient(var(--color-surface-2)_0_25%,var(--color-surface)_0_50%)] bg-[length:18px_18px] flex justify-center">
            <div className="pointer-events-none w-[210px] flex flex-col [&>*]:flex-1" aria-hidden data-testid="uc-preview"><UserCardView id="preview" data={preview} /></div>
          </div>

          <div className="flex flex-col gap-2">
            {label('Kart türü')}
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Kart türü">
              {KINDS.map((k) => (
                <button key={k.id} type="button" role="radio" aria-checked={d.kind === k.id} onClick={() => set({ kind: k.id, title: '' })} data-testid={`uc-kind-${k.id}`}
                  className="min-h-[86px] rounded-[16px] border border-line bg-surface-2 p-2 flex flex-col items-center justify-center gap-1.5 text-center aria-checked:border-2 aria-checked:border-acc aria-checked:bg-[color-mix(in_oklab,var(--color-acc)_10%,var(--color-surface-2))]">
                  <span data-mod={k.mod} className="text-acc"><Ico name={k.icon} size={22} /></span>
                  <b className="text-[12.5px] leading-tight">{k.label}</b>
                  <span className="text-[10.5px] text-mute leading-tight">{k.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {d.kind === 'metric' ? (
            <div className="flex flex-col gap-2">
              {label('Veri')}
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Veri" data-testid="uc-metric">
                {METRICS.map((m) => <button key={m.id} type="button" role="radio" aria-checked={d.metric === m.id} onClick={() => set({ metric: m.id })} data-metric={m.id} className={chipClass}>{m.label}</button>)}
              </div>
            </div>
          ) : null}
          {d.kind === 'tracker' ? (trackers.length ? (
            <div className="flex flex-col gap-2">
              {label('Takip alanı')}
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Takip alanı" data-testid="uc-tracker">
                {trackers.map((t) => <button key={t.id} type="button" role="radio" aria-checked={d.trackerId === t.id} onClick={() => set({ trackerId: t.id })} data-tracker={t.id} className={chipClass}>{t.emoji} {t.name}</button>)}
              </div>
            </div>
          ) : <p className="text-[13px] text-mute rounded-[14px] bg-surface-2 p-3">Henüz takip alanın yok. <Link href="/profil/ozellestirme/takip" className="font-bold text-acc">Takip alanı ekle ›</Link></p>) : null}
          {d.kind === 'metric' || d.kind === 'tracker' ? <>
            <div className="flex flex-col gap-2">
              {label('Dönem')}
              <div className="grid grid-cols-3 gap-1 p-1 rounded-full bg-surface-2" role="radiogroup" aria-label="Dönem">{PERIODS.map((p) => <button key={p.id} type="button" role="radio" aria-checked={d.period === p.id} onClick={() => set({ period: p.id })} className={segClass}>{p.label}</button>)}</div>
            </div>
            <div className="flex flex-col gap-2">
              {label('Görünüm')}
              <div className="grid grid-cols-3 gap-1 p-1 rounded-full bg-surface-2" role="radiogroup" aria-label="Görünüm">{VIEWS.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={d.view === v} onClick={() => set({ view: v })} className={segClass} data-testid={`uc-view-${v}`}>{l}</button>)}</div>
            </div>
            {d.kind === 'metric' ? <label className="flex flex-col gap-2">{label('Hedef (isteğe bağlı)')}<input className={inp + ' num'} value={d.goal} onChange={(e) => set({ goal: e.target.value })} inputMode="decimal" placeholder={`Ör. ${d.metric === 'water' ? '2500' : d.metric === 'kcal' ? '2200' : d.metric === 'protein' ? '120' : d.metric === 'weight' ? '70' : '4'}`} /></label> : null}
          </> : null}
          {d.kind === 'quote' ? <label className="flex flex-col gap-2">{label('Söz')}<textarea className={`${inp} h-24 py-2.5`} value={d.text} onChange={(e) => set({ text: e.target.value })} maxLength={160} placeholder="Bugün dünden biraz daha iyi." data-testid="uc-text" /></label> : null}
          {d.kind === 'countdown' ? <label className="flex flex-col gap-2">{label('Tarih')}<input type="date" className={inp} value={d.date} onChange={(e) => set({ date: e.target.value })} data-testid="uc-date" /></label> : null}
          {d.kind === 'photo' ? (
            <label className="min-h-12 rounded-[14px] border border-dashed border-line-2 font-bold text-[14px] inline-flex items-center justify-center gap-2 cursor-pointer">
              <Ico name="photo" size={18} />{d.mediaId ? 'Fotoğrafı değiştir' : 'Fotoğraf seç'}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f) }} data-testid="uc-photo" />
            </label>
          ) : null}

          <label className="flex flex-col gap-2">{label('Kart adı')}<input className={inp} value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={30} placeholder={autoTitle} data-testid="uc-name" /></label>
          <div className="flex flex-col gap-2">
            {label('Hangi ekranda')}
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Ekran" data-testid="uc-screen">
              {screens.map((s) => <button key={s.id} type="button" role="radio" aria-checked={d.screen === s.id} onClick={() => set({ screen: s.id })} data-screen-chip={s.id} className={chipClass}>{s.title}</button>)}
            </div>
          </div>
          <p className="text-[12px] text-mute leading-snug">Rengini ekranda düzenleme modunda ✎ ile değiştirebilirsin. Kendi kartların şablon paylaşırken çıkarılır.</p>
          {formMsg ? <p className="text-[13px] font-bold text-danger" role="alert">{formMsg}</p> : null}

          <div className="sheet-actions z-10 -mx-5 px-5 pt-4 bg-gradient-to-t from-surface via-surface to-transparent">
            <div className="flex gap-2">
              {editing ? <button type="button" onClick={() => setOpen(false)} className="h-14 px-5 rounded-full bg-surface-2 border border-line-2 font-bold">Vazgeç</button> : null}
              <button type="button" disabled={pending || !valid} onClick={save} className="flex-1 h-14 rounded-full bg-acc text-acc-ink font-extrabold text-[15px] disabled:opacity-40" data-testid="uc-save">{editing ? 'Kaydet' : 'Kartı ekle'}</button>
            </div>
          </div>
        </div>
      </Sheet>
    </>
  )
}
