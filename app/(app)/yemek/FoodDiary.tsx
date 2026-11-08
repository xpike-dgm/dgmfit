'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useOptimistic, useState, useTransition, type ReactNode } from 'react'
import Sheet from '@/components/Sheet'
import { Band, Bar, btn, hdrBtn } from '@/components/ui'
import { Back, Dots, Next, Plus, Spark, Trash } from '@/components/icons'
import { fmtNum } from '@/lib/calc'
import { MEALS, MEAL_LABEL, isBasePortion, type MealId } from '@/lib/food'
import { NUTRIENT_INFO, type NutrientKey } from '@/lib/nutrition'
import { addQuickCalories, addUsualMeal, copyMeal, deleteMealItem, saveMealAsTemplate, updateMealItem } from './actions'
import DayCardSheet from './DayCardSheet'
import InfoTip from '@/components/InfoTip'
import CardBoard from '@/components/cards/CardBoard'
import type { CardColors } from '@/lib/cards/colors'

interface Item { id: number; meal: MealId; name: string; grams: number; portionLabel: string | null; portionQty: number | null; kcal: number; protein: number; carb: number; fat: number; source: string }
interface MealBlock { id: MealId; label: string; share: number; items: Item[]; totals: { kcal: number; protein: number; carb: number; fat: number } }

export default function FoodDiary(p: {
  day: string; isToday: boolean; prevDay: string; nextDay: string | null; dayLabel: string
  meals: MealBlock[]; totals: { kcal: number; protein: number; carb: number; fat: number }
  target: { kcal: number; protein: number; carb: number; fat: number }; burned: number
  adjust: { base: number; kcal: number; closed: boolean } | null
  trained?: boolean
  micro: Record<string, number>; suggested: MealId; yesterdayHas: Record<MealId, number>
  supplements?: ReactNode
  /** Faz 8: detaylı besin hedefleri (sunucuda hazırlanır) */
  detail?: ReactNode
  /** Sade modda takviye kartı boşsa gizlenir */
  hasSupplements?: boolean
  /** Gelişmiş mod (sadeleştirme 2026-11-06) */
  adv?: boolean
  /** P-7 hızlı kayıt: öğün alışkanlıkları ("her zamanki kahvaltın") */
  usual?: Partial<Record<MealId, { names: string[]; kcal: number }>>
  /** Özelleştirme: ekranın kart düzeni (sunucuda çözülür) */
  layout: { items: { id: string; size: 'half' | 'full'; stack?: string[] }[]; drawer: { id: string; reason: 'removed' | 'new' | 'available' }[]; notices: string[]; applied?: string[]; quick?: Record<string, string>; pinned?: string[]; colors?: Record<string, CardColors>; titles?: Record<string, string>; extra?: Record<string, ReactNode> }
  editing?: boolean
  /** Ö5b: Ramazan'da öğün adları (Sahur / İftar) */
  mealLabels?: Record<MealId, string>
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [edit, setEdit] = useState<Item | null>(null)
  const [quick, setQuick] = useState<MealId | null>(null)
  const [menu, setMenu] = useState<MealId | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  // P-4: silme ve miktar değişikliği sunucuyu beklemeden ekrana yansır (hata olursa yenilemede geri gelir)
  type Op = { type: 'del'; id: number } | { type: 'upd'; id: number; grams: number; meal: MealId }
  const [meals, applyOp] = useOptimistic(p.meals, (cur: MealBlock[], op: Op) => {
    const all = cur.flatMap((m) => m.items)
    const it = all.find((x) => x.id === op.id)
    if (!it) return cur
    const next = op.type === 'del' ? null : (() => { const f = it.grams > 0 ? op.grams / it.grams : 1; return { ...it, grams: op.grams, meal: op.meal, kcal: Math.round(it.kcal * f), protein: it.protein * f, carb: it.carb * f, fat: it.fat * f } })()
    return cur.map((m) => {
      const items = m.items.filter((x) => x.id !== op.id).concat(next && next.meal === m.id ? [next] : [])
      const totals = items.reduce((a, x) => ({ kcal: a.kcal + x.kcal, protein: a.protein + x.protein, carb: a.carb + x.carb, fat: a.fat + x.fat }), { kcal: 0, protein: 0, carb: 0, fat: 0 })
      return { ...m, items, totals }
    })
  })
  const optimistic = meals !== p.meals
  // iyimser durumda yalnızca öğün farkı uygulanır (sunucu toplamı takviyeleri de içerir)
  const sumOf = (ms: MealBlock[]) => ms.reduce((a, m) => ({ kcal: a.kcal + m.totals.kcal, protein: a.protein + m.totals.protein, carb: a.carb + m.totals.carb, fat: a.fat + m.totals.fat }), { kcal: 0, protein: 0, carb: 0, fat: 0 })
  const totals = optimistic ? (() => { const a = sumOf(meals), b = sumOf(p.meals); return { kcal: p.totals.kcal + a.kcal - b.kcal, protein: p.totals.protein + a.protein - b.protein, carb: p.totals.carb + a.carb - b.carb, fat: p.totals.fat + a.fat - b.fat } })() : p.totals
  const budget = p.target.kcal + p.burned
  const left = budget - totals.kcal
  const macro = [
    { k: 'P', name: 'Protein', v: totals.protein, g: p.target.protein, c: 'var(--color-protein)' },
    { k: 'K', name: 'Karbonhidrat', v: totals.carb, g: p.target.carb, c: 'var(--color-orange)' },
    { k: 'Y', name: 'Yağ', v: totals.fat, g: p.target.fat, c: 'var(--color-violet)' },
  ]
  const run = (f: () => Promise<{ ok: boolean; error?: string }>, done?: string, op?: Op) => start(async () => {
    if (op) applyOp(op)
    const r = await f()
    setMsg(r.ok ? done ?? null : r.error ?? 'Hata')
    router.refresh()
  })
  const q = `gun=${p.day}`

  return (
    <div className="px-4 flex flex-col gap-3" data-testid="diary-state" data-left={left} data-budget={budget}>
      <CardBoard screen="food" editing={!!p.editing} items={p.layout.items} drawer={p.layout.drawer} notices={p.layout.notices} applied={p.layout.applied} quick={p.layout.quick} pinned={p.layout.pinned} colors={p.layout.colors} titles={p.layout.titles} nodes={{
        ...p.layout.extra,
        'food.header': (
      <Band title="Yemek" sub={<span className="capitalize">{p.isToday ? `Bugün · ${p.dayLabel}` : p.dayLabel}</span>}
        right={<div className="flex items-center gap-2 shrink-0">{!p.isToday ? <Link href="/yemek" className={hdrBtn}>Bugüne dön</Link> : null}<DayCardSheet day={p.day} /></div>}
        ring={{ value: budget > 0 ? Math.min(1, totals.kcal / budget) : 0, big: fmtNum(Math.abs(left)), small: left >= 0 ? 'kalan kcal' : 'kcal aşım', label: `Bütçenin yüzde ${budget > 0 ? Math.round((totals.kcal / budget) * 100) : 0}'i` }}
        pills={macro.map((m) => [m.name, `${fmtNum(m.v)} / ${fmtNum(m.g)} g`] as [string, string])} />
        ),
        'food.summary': (
      <section aria-label="Günlük özet" className="card px-2 py-2 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/yemek?gun=${p.prevDay}`} aria-label="Önceki gün" className="w-11 h-11 rounded-full flex items-center justify-center text-mute"><Back size={20} /></Link>
          <div className="flex flex-col items-center text-center">
            <span className="num text-[20px] font-bold leading-tight inline-flex items-center gap-1.5">{fmtNum(totals.kcal)} <span className="text-[13px] text-mute font-semibold">/ {fmtNum(budget)} kcal</span>
              {!p.adv && (p.burned || p.adjust?.kcal || p.adjust?.closed) ? <InfoTip label="Kalori bütçesi">
                {p.burned ? <span className="block">Hedef {fmtNum(p.target.kcal)} + egzersiz {fmtNum(p.burned)} kcal.</span> : null}
                {p.adjust?.kcal ? <span className="block">Plan {fmtNum(p.adjust.base)} {p.adjust.kcal > 0 ? '+' : '−'} {fmtNum(Math.abs(p.adjust.kcal))} dengeleme = {fmtNum(p.target.kcal)} kcal.</span> : null}
                {p.adjust?.closed ? <span className="block">Gün kapandı; değişiklikler dengelemeyi yeniden hesaplar.</span> : null}
              </InfoTip> : null}</span>
            {p.adv && p.burned ? <span className="text-xs text-mute">Hedef {fmtNum(p.target.kcal)} + egzersiz {fmtNum(p.burned)}</span> : null}
            {p.adv && p.adjust?.kcal ? <Link href="/fit" className="text-xs text-mute" data-testid="adjust-note">Plan {fmtNum(p.adjust.base)} {p.adjust.kcal > 0 ? '+' : '−'} {fmtNum(Math.abs(p.adjust.kcal))} dengeleme = {fmtNum(p.target.kcal)} kcal</Link> : null}
            {p.adv && p.adjust?.closed ? <span className="text-xs text-mute">Gün kapandı · değişiklikler dengelemeyi yeniden hesaplar</span> : null}
          </div>
          {p.nextDay ? <Link href={`/yemek?gun=${p.nextDay}`} aria-label="Sonraki gün" className="w-11 h-11 rounded-full flex items-center justify-center text-mute"><Next size={20} /></Link> : <span className="w-11 h-11 flex items-center justify-center text-faint opacity-40" aria-hidden><Next size={20} /></span>}
        </div>
        <div className="grid grid-cols-3 gap-2 px-2 pb-1">
          {macro.map((m) => <Bar key={m.k} value={m.g ? m.v / m.g : 0} color={m.c} height={5} />)}
        </div>
      </section>
        ),
        'food.add': (
      <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <Link href={`/yemek/ekle?ogun=${p.suggested}&${q}`} className="h-[72px] rounded-[20px] bg-acc text-acc-ink font-extrabold text-sm flex flex-col items-center justify-center gap-1"><Plus size={20} />Besin ekle</Link>
        <Link href={`/yemek/ekle?ogun=${p.suggested}&${q}&barkod=1`} className="h-[72px] rounded-[20px] bg-surface font-bold text-sm flex flex-col items-center justify-center gap-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="text-acc"><path d="M4 6v12M7 6v12M11 6v12M14 6v12M18 6v12M20 6v12" /></svg>Barkod
        </Link>
        <button type="button" onClick={() => setQuick(p.suggested)} className="h-[72px] rounded-[20px] bg-surface font-bold text-sm flex flex-col items-center justify-center gap-1">
          <span className="num text-acc font-bold">kcal</span>Hızlı kalori
        </button>
      </div>
      {msg ? <p role="status" className="text-sm text-ink-2 px-1">{msg}</p> : null}
      </div>
        ),
        'food.ai': p.isToday ? (
        <nav aria-label="AI planlama" className="grid grid-cols-3 gap-2" data-testid="ai-plan-links">
          <Link href="/yemek/plan" className="h-14 rounded-[18px] bg-coach border border-coach-line text-[13px] font-bold flex items-center justify-center text-center px-2">AI menü</Link>
          <Link href="/yemek/elimdeki" className="h-14 rounded-[18px] bg-coach border border-coach-line text-[13px] font-bold flex items-center justify-center text-center px-2">Elimde bunlar var</Link>
          <Link href="/yemek/restoran" className="h-14 rounded-[18px] bg-coach border border-coach-line text-[13px] font-bold flex items-center justify-center text-center px-2">Restoran modu</Link>
        </nav>
      ) : null,
        'food.meals': (
      <div className="flex flex-col gap-3">
      {meals.map((m) => (
        <section key={m.id} aria-label={m.label} className="card px-4 py-3 flex flex-col">
          <div className="flex items-center justify-between min-h-11">
            <div className="flex flex-col">
              <span className="font-extrabold">{m.label}</span>
              <span className="text-xs text-mute">{m.items.length ? `P ${fmtNum(m.totals.protein)} · K ${fmtNum(m.totals.carb)} · Y ${fmtNum(m.totals.fat)} g` : `Önerilen ~${fmtNum(Math.round((p.target.kcal * m.share) / 10) * 10)} kcal`}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="num font-bold mr-1">{fmtNum(m.totals.kcal)}</span>
              <button type="button" aria-label={`${m.label} seçenekleri`} onClick={() => setMenu(m.id)} className="w-10 h-10 flex items-center justify-center text-mute"><Dots size={18} /></button>
              <Link href={`/yemek/ekle?ogun=${m.id}&${q}`} aria-label={`${m.label} öğününe ekle`} className="w-10 h-10 rounded-full border border-line-2 flex items-center justify-center"><Plus size={16} /></Link>
            </div>
          </div>
          {!m.items.length && p.usual?.[m.id] ? (
            <button type="button" disabled={pending} data-testid="usual-meal" data-meal={m.id}
              onClick={() => run(() => addUsualMeal(m.id, p.day), `Her zamanki ${m.label.toLocaleLowerCase('tr-TR')} eklendi`)}
              className="flex items-center justify-between gap-3 py-2.5 border-t border-surface-2 text-left">
              <span className="flex flex-col min-w-0">
                <span className="text-sm font-semibold">Her zamanki {m.label.toLocaleLowerCase('tr-TR')}</span>
                <span className="text-xs text-mute line-clamp-2">{p.usual[m.id]!.names.join(', ')} · {fmtNum(p.usual[m.id]!.kcal)} kcal</span>
              </span>
              <span className="shrink-0 h-9 px-3 rounded-full bg-acc text-acc-ink text-[13px] font-bold inline-flex items-center gap-1"><Plus size={14} /> Ekle</span>
            </button>
          ) : null}
          {m.items.map((it) => (
            <button key={it.id} type="button" onClick={() => setEdit(it)} className="flex items-center justify-between gap-3 py-2.5 border-t border-surface-2 text-left">
              <span className="flex flex-col min-w-0">
                <span className="text-sm font-semibold truncate">{it.name}</span>
                <span className="text-xs text-mute truncate">{it.source === 'quick' ? 'Elle girilen kalori' : it.portionLabel && !isBasePortion(it.portionLabel) ? `${fmtNum(it.portionQty ?? 1, (it.portionQty ?? 1) % 1 ? 1 : 0)} × ${it.portionLabel}` : `${fmtNum(it.grams)} ${it.portionLabel === '100 ml' ? 'ml' : 'g'}`}</span>
              </span>
              <span className="num text-sm text-ink-2 shrink-0">{fmtNum(it.kcal)}</span>
            </button>
          ))}
        </section>
      ))}
      </div>
        ),
        'food.detail': p.detail ?? null,
        'food.supplements': p.adv || p.hasSupplements || p.editing ? p.supplements : null,
        'food.micro': Object.keys(p.micro).length ? (
        <details className="card px-4 py-3">
          <summary className="font-extrabold cursor-pointer list-none flex justify-between items-center min-h-11">Besin detayları <span className="text-mute text-sm">›</span></summary>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 text-sm">
            {(['fiber', 'sugar', 'satFat', 'sodium', 'chol', 'ca', 'fe', 'k', 'mg', 'zn', 'vitC', 'vitD', 'vitA', 'b6', 'b12'] as NutrientKey[]).filter((k) => p.micro[k] !== undefined).map((k) => (
              <div key={k} className="flex justify-between border-b border-surface-2 py-1.5">
                <dt className="text-mute">{NUTRIENT_INFO[k].label}</dt>
                <dd className="num">{fmtNum(p.micro[k], p.micro[k] < 10 ? 1 : 0)} {NUTRIENT_INFO[k].unit}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[11px] text-mute mt-2">Bazı besinlerde (paketli ürünler, hızlı kalori) mikro besin bilgisi olmadığından toplamlar eksik olabilir.</p>
        </details>
      ) : null,
        'food.tip': (
      <section className="rounded-[24px] p-4 flex gap-3 bg-coach border border-coach-line">
        <Spark size={18} className="text-acc shrink-0 mt-0.5" />
        <p className="text-sm leading-relaxed text-ink">
          {firstSentence(!p.adv, p.trained && p.isToday && p.target.protein - p.totals.protein > 20 ? `Bugün antrenman yaptın: toparlanma için önümüzdeki öğünde 25–40 g protein al (kalan hedef ${fmtNum(p.target.protein - p.totals.protein)} g). Yoğurt + yulaf, tavuk, ton balığı ya da yumurta iyi seçenekler.`
            : p.totals.kcal === 0 ? 'İlk öğününü ekleyerek başla. Son kullandıkların ve kayıtlı öğünlerin tek dokunuşla eklenir.'
            : p.target.protein - p.totals.protein > 25 && left > 150 ? `Kalan ${fmtNum(left)} kcal içinde ${fmtNum(p.target.protein - p.totals.protein)} g protein hedefin var. Tavuk, yoğurt, yumurta ya da baklagil iyi seçenekler.`
              : left < 0 ? `Bugün hedefin ${fmtNum(-left)} kcal üstündesin. Fark, akıllı dengeleme ile sonraki günlere yayılacak.`
                : 'Makroların dengeli gidiyor. Akşam öğününü kalan bütçeye göre planlayabilirsin.')}
        </p>
      </section>
        ),
      }} />

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.name ?? ''}>
        {edit ? <EditItem item={edit} onSave={(v) => { setEdit(null); run(() => updateMealItem({ id: edit.id, ...v }), 'Kayıt güncellendi', { type: 'upd', id: edit.id, grams: v.grams, meal: v.meal }) }} onDelete={() => { setEdit(null); run(() => deleteMealItem(edit.id), 'Kayıt silindi', { type: 'del', id: edit.id }) }} /> : null}
      </Sheet>
      <Sheet open={!!quick} onClose={() => setQuick(null)} title="Hızlı kalori">
        {quick ? <QuickForm meal={quick} onSave={(v) => { setQuick(null); run(() => addQuickCalories({ ...v, day: p.day }), 'Eklendi') }} /> : null}
      </Sheet>
      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu ? (p.mealLabels ?? MEAL_LABEL)[menu] : ''}>
        {menu ? (
          <div className="flex flex-col gap-2 pb-4">
            <button type="button" disabled={!p.yesterdayHas[menu] || pending} onClick={() => { const m = menu; setMenu(null); run(() => copyMeal({ fromDay: p.prevDay, fromMeal: m, toDay: p.day, toMeal: m }), 'Önceki günden kopyalandı') }}
              className="min-h-[56px] px-4 rounded-[18px] bg-surface-2 text-left font-bold disabled:opacity-40">
              Önceki günün {(p.mealLabels ?? MEAL_LABEL)[menu].toLocaleLowerCase('tr-TR')} öğününü kopyala <span className="text-mute font-normal text-sm">({p.yesterdayHas[menu] ?? 0} besin)</span>
            </button>
            <SaveTemplate disabled={!p.meals.find((m) => m.id === menu)?.items.length} onSave={(name) => { const m = menu; setMenu(null); run(() => saveMealAsTemplate(p.day, m, name), 'Öğün kaydedildi') }} />
            <button type="button" onClick={() => { const m = menu; setMenu(null); setQuick(m) }} className="min-h-[56px] px-4 rounded-[18px] bg-surface-2 text-left font-bold">Hızlı kalori ekle</button>
            <Link href="/yemek/takviyeler" className="min-h-[56px] px-4 rounded-[18px] bg-surface-2 font-bold flex items-center">Takviyelerim</Link>
          </div>
        ) : null}
      </Sheet>
    </div>
  )
}

function EditItem({ item, onSave, onDelete }: { item: Item; onSave: (v: { grams: number; portionLabel: string | null; portionQty: number | null; meal: MealId }) => void; onDelete: () => void }) {
  const [g, setG] = useState(String(item.grams))
  const [meal, setMeal] = useState<MealId>(item.meal)
  const quick = item.source === 'quick'
  const ml = item.portionLabel === '100 ml'
  const v = Number(g.replace(',', '.'))
  return (
    <div className="flex flex-col gap-4 pb-4">
      {!quick ? (
        <div className="flex items-center gap-3">
          <label htmlFor="ed-g" className="text-sm font-bold flex-1">Miktar ({ml ? 'ml' : 'gram'})</label>
          <input id="ed-g" inputMode="decimal" value={g} onChange={(e) => setG(e.target.value)} className="w-28 h-12 rounded-xl bg-surface-2 border border-line px-3 num text-lg text-right" />
        </div>
      ) : <p className="text-sm text-mute">Hızlı kalori kaydı: {fmtNum(item.kcal)} kcal</p>}
      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Öğün">
        {MEALS.map((x) => <button key={x.id} type="button" aria-pressed={meal === x.id} onClick={() => setMeal(x.id)} className={`h-10 rounded-full text-[13px] font-bold border ${meal === x.id ? 'bg-acc text-acc-ink border-acc' : 'bg-surface-2 text-ink-2 border-line'}`}>{x.label.replace(' yemeği', '')}</button>)}
      </div>
      <button type="button" disabled={!quick && !(v >= 1 && v <= 5000)} onClick={() => onSave({ grams: quick ? item.grams || 1 : v, portionLabel: quick ? null : ml ? '100 ml' : '100 g', portionQty: quick ? null : v, meal })} className="h-14 rounded-full bg-acc text-acc-ink font-extrabold disabled:opacity-40">Kaydet</button>
      <button type="button" onClick={onDelete} className="h-12 rounded-full border border-danger-line text-danger font-bold flex items-center justify-center gap-2"><Trash size={18} /> Sil</button>
    </div>
  )
}

function QuickForm({ meal, onSave }: { meal: MealId; onSave: (v: { name?: string; kcal: number; protein?: number; carb?: number; fat?: number; meal: MealId }) => void }) {
  const [v, setV] = useState({ name: '', kcal: '', protein: '', carb: '', fat: '' })
  const n = (s: string) => (s ? Number(s.replace(',', '.')) : undefined)
  const kcal = n(v.kcal) ?? 0
  const field = (k: keyof typeof v, label: string, unit = 'g') => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`q-${k}`} className="text-xs text-mute">{label}</label>
      <input id={`q-${k}`} inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} placeholder={unit} className="h-12 rounded-xl bg-surface-2 border border-line px-3 num text-ink" />
    </div>
  )
  return (
    <form className="flex flex-col gap-3 pb-4" onSubmit={(e) => { e.preventDefault(); if (kcal >= 1) onSave({ name: v.name || undefined, kcal: Math.round(kcal), protein: n(v.protein), carb: n(v.carb), fat: n(v.fat), meal }) }}>
      <div className="flex flex-col gap-1">
        <label htmlFor="q-name" className="text-xs text-mute">Ne yedin? (isteğe bağlı)</label>
        <input id="q-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value.slice(0, 60) })} placeholder="Ör. restoranda akşam yemeği" className="h-12 rounded-xl bg-surface-2 border border-line px-3 text-ink" />
      </div>
      <div className="grid grid-cols-4 gap-2">{field('kcal', 'Kalori', 'kcal')}{field('protein', 'Protein')}{field('carb', 'Karb.')}{field('fat', 'Yağ')}</div>
      <button type="submit" disabled={kcal < 1} className="h-14 rounded-full bg-acc text-acc-ink font-extrabold disabled:opacity-40">{MEAL_LABEL[meal]} · ekle</button>
    </form>
  )
}

function SaveTemplate({ disabled, onSave }: { disabled: boolean; onSave: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave(name.trim()) }}>
      <label htmlFor="tpl" className="sr-only">Öğün adı</label>
      <input id="tpl" disabled={disabled} value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder={disabled ? 'Kaydetmek için öğüne besin ekle' : 'Öğün adı (ör. Klasik kahvaltım)'} className="flex-1 h-12 rounded-xl bg-surface-2 border border-line px-3 text-ink disabled:opacity-50" />
      <button type="submit" disabled={disabled || !name.trim()} className="h-12 px-4 rounded-full bg-acc text-acc-ink font-extrabold text-sm disabled:opacity-40">Kaydet</button>
    </form>
  )
}

/** Sade modda uzun ipucunun yalnızca ilk cümlesi. */
function firstSentence(short: boolean, t: string) {
  if (!short) return t
  const i = t.search(/[.!?](\s|$)/)
  return i > 0 ? t.slice(0, i + 1) : t
}
