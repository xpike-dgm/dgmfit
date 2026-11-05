'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition, type ReactNode } from 'react'
import Sheet from '@/components/Sheet'
import { Band, Bar, btn, hdrBtn } from '@/components/ui'
import { Back, Dots, Next, Plus, Spark, Trash } from '@/components/icons'
import { fmtNum } from '@/lib/calc'
import { MEALS, MEAL_LABEL, type MealId } from '@/lib/food'
import { NUTRIENT_INFO, type NutrientKey } from '@/lib/nutrition'
import { addQuickCalories, copyMeal, deleteMealItem, saveMealAsTemplate, updateMealItem } from './actions'

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
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [edit, setEdit] = useState<Item | null>(null)
  const [quick, setQuick] = useState<MealId | null>(null)
  const [menu, setMenu] = useState<MealId | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const budget = p.target.kcal + p.burned
  const left = budget - p.totals.kcal
  const macro = [
    { k: 'P', name: 'Protein', v: p.totals.protein, g: p.target.protein, c: 'var(--color-protein)' },
    { k: 'K', name: 'Karbonhidrat', v: p.totals.carb, g: p.target.carb, c: 'var(--color-orange)' },
    { k: 'Y', name: 'Yağ', v: p.totals.fat, g: p.target.fat, c: 'var(--color-violet)' },
  ]
  const run = (f: () => Promise<{ ok: boolean; error?: string }>, done?: string) => start(async () => {
    const r = await f()
    setMsg(r.ok ? done ?? null : r.error ?? 'Hata')
    router.refresh()
  })
  const q = `gun=${p.day}`

  return (
    <div className="px-4 flex flex-col gap-3">
      <Band title="Yemek" sub={<span className="capitalize">{p.isToday ? `Bugün · ${p.dayLabel}` : p.dayLabel}</span>}
        right={!p.isToday ? <Link href="/yemek" className={hdrBtn}>Bugüne dön</Link> : undefined}
        ring={{ value: budget > 0 ? Math.min(1, p.totals.kcal / budget) : 0, big: fmtNum(Math.abs(left)), small: left >= 0 ? 'kalan kcal' : 'kcal aşım', label: `Bütçenin yüzde ${budget > 0 ? Math.round((p.totals.kcal / budget) * 100) : 0}'i` }}
        pills={macro.map((m) => [m.name, `${fmtNum(m.v)} / ${fmtNum(m.g)} g`] as [string, string])} />

      <section aria-label="Günlük özet" className="card px-2 py-2 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/yemek?gun=${p.prevDay}`} aria-label="Önceki gün" className="w-11 h-11 rounded-full flex items-center justify-center text-mute"><Back size={20} /></Link>
          <div className="flex flex-col items-center text-center">
            <span className="num text-[20px] font-bold leading-tight">{fmtNum(p.totals.kcal)} <span className="text-[13px] text-mute font-semibold">/ {fmtNum(budget)} kcal</span></span>
            {p.burned ? <span className="text-xs text-mute">Hedef {fmtNum(p.target.kcal)} + egzersiz {fmtNum(p.burned)}</span> : null}
            {p.adjust?.kcal ? <Link href="/fit" className="text-xs text-mute" data-testid="adjust-note">Plan {fmtNum(p.adjust.base)} {p.adjust.kcal > 0 ? '+' : '−'} {fmtNum(Math.abs(p.adjust.kcal))} dengeleme = {fmtNum(p.target.kcal)} kcal</Link> : null}
            {p.adjust?.closed ? <span className="text-xs text-mute">Gün kapandı · değişiklikler dengelemeyi yeniden hesaplar</span> : null}
          </div>
          {p.nextDay ? <Link href={`/yemek?gun=${p.nextDay}`} aria-label="Sonraki gün" className="w-11 h-11 rounded-full flex items-center justify-center text-mute"><Next size={20} /></Link> : <span className="w-11 h-11 flex items-center justify-center text-faint opacity-40" aria-hidden><Next size={20} /></span>}
        </div>
        <div className="grid grid-cols-3 gap-2 px-2 pb-1">
          {macro.map((m) => <Bar key={m.k} value={m.g ? m.v / m.g : 0} color={m.c} height={5} />)}
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2">
        <Link href={`/yemek/ekle?ogun=${p.suggested}&${q}`} className="h-[72px] rounded-[20px] bg-acc text-acc-ink font-extrabold text-sm flex flex-col items-center justify-center gap-1"><Plus size={20} />Besin ekle</Link>
        <Link href={`/yemek/ekle?ogun=${p.suggested}&${q}&barkod=1`} className="h-[72px] rounded-[20px] bg-surface font-bold text-sm flex flex-col items-center justify-center gap-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="text-acc"><path d="M4 6v12M7 6v12M11 6v12M14 6v12M18 6v12M20 6v12" /></svg>Barkod
        </Link>
        <button type="button" onClick={() => setQuick(p.suggested)} className="h-[72px] rounded-[20px] bg-surface font-bold text-sm flex flex-col items-center justify-center gap-1">
          <span className="num text-acc font-bold">kcal</span>Hızlı kalori
        </button>
      </div>

      {p.isToday ? (
        <nav aria-label="AI planlama" className="grid grid-cols-3 gap-2" data-testid="ai-plan-links">
          <Link href="/yemek/plan" className="h-14 rounded-[18px] bg-coach border border-coach-line text-[13px] font-bold flex items-center justify-center text-center px-2">AI menü</Link>
          <Link href="/yemek/elimdeki" className="h-14 rounded-[18px] bg-coach border border-coach-line text-[13px] font-bold flex items-center justify-center text-center px-2">Elimde bunlar var</Link>
          <Link href="/yemek/restoran" className="h-14 rounded-[18px] bg-coach border border-coach-line text-[13px] font-bold flex items-center justify-center text-center px-2">Restoran modu</Link>
        </nav>
      ) : null}

      {msg ? <p role="status" className="text-sm text-ink-2 px-1">{msg}</p> : null}

      {p.meals.map((m) => (
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
          {m.items.map((it) => (
            <button key={it.id} type="button" onClick={() => setEdit(it)} className="flex items-center justify-between gap-3 py-2.5 border-t border-surface-2 text-left">
              <span className="flex flex-col min-w-0">
                <span className="text-sm font-semibold truncate">{it.name}</span>
                <span className="text-xs text-mute truncate">{it.source === 'quick' ? 'Elle girilen kalori' : it.portionLabel && it.portionLabel !== '100 g' ? `${fmtNum(it.portionQty ?? 1, (it.portionQty ?? 1) % 1 ? 1 : 0)} × ${it.portionLabel}` : `${fmtNum(it.grams)} g`}</span>
              </span>
              <span className="num text-sm text-ink-2 shrink-0">{fmtNum(it.kcal)}</span>
            </button>
          ))}
        </section>
      ))}

      {p.supplements}

      {Object.keys(p.micro).length ? (
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
      ) : null}

      <section className="rounded-[24px] p-4 flex gap-3 bg-coach border border-coach-line">
        <Spark size={18} className="text-acc shrink-0 mt-0.5" />
        <p className="text-sm leading-relaxed text-ink">
          {p.trained && p.isToday && p.target.protein - p.totals.protein > 20 ? `Bugün antrenman yaptın: toparlanma için önümüzdeki öğünde 25–40 g protein al (kalan hedef ${fmtNum(p.target.protein - p.totals.protein)} g). Yoğurt + yulaf, tavuk, ton balığı ya da yumurta iyi seçenekler.`
            : p.totals.kcal === 0 ? 'İlk öğününü ekleyerek başla. Son kullandıkların ve kayıtlı öğünlerin tek dokunuşla eklenir.'
            : p.target.protein - p.totals.protein > 25 && left > 150 ? `Kalan ${fmtNum(left)} kcal içinde ${fmtNum(p.target.protein - p.totals.protein)} g protein hedefin var. Tavuk, yoğurt, yumurta ya da baklagil iyi seçenekler.`
              : left < 0 ? `Bugün hedefin ${fmtNum(-left)} kcal üstündesin. Fark, akıllı dengeleme ile sonraki günlere yayılacak (Faz 2b).`
                : 'Makroların dengeli gidiyor. Akşam öğününü kalan bütçeye göre planlayabilirsin.'}
        </p>
      </section>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.name ?? ''}>
        {edit ? <EditItem item={edit} onSave={(v) => { setEdit(null); run(() => updateMealItem({ id: edit.id, ...v }), 'Kayıt güncellendi') }} onDelete={() => { setEdit(null); run(() => deleteMealItem(edit.id), 'Kayıt silindi') }} /> : null}
      </Sheet>
      <Sheet open={!!quick} onClose={() => setQuick(null)} title="Hızlı kalori">
        {quick ? <QuickForm meal={quick} onSave={(v) => { setQuick(null); run(() => addQuickCalories({ ...v, day: p.day }), 'Eklendi') }} /> : null}
      </Sheet>
      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu ? MEAL_LABEL[menu] : ''}>
        {menu ? (
          <div className="flex flex-col gap-2 pb-4">
            <button type="button" disabled={!p.yesterdayHas[menu] || pending} onClick={() => { const m = menu; setMenu(null); run(() => copyMeal({ fromDay: p.prevDay, fromMeal: m, toDay: p.day, toMeal: m }), 'Önceki günden kopyalandı') }}
              className="min-h-[56px] px-4 rounded-[18px] bg-surface-2 text-left font-bold disabled:opacity-40">
              Önceki günün {MEAL_LABEL[menu].toLocaleLowerCase('tr-TR')} öğününü kopyala <span className="text-mute font-normal text-sm">({p.yesterdayHas[menu] ?? 0} besin)</span>
            </button>
            <SaveTemplate disabled={!p.meals.find((m) => m.id === menu)?.items.length} onSave={(name) => { const m = menu; setMenu(null); run(() => saveMealAsTemplate(p.day, m, name), 'Öğün kaydedildi') }} />
            <button type="button" onClick={() => { const m = menu; setMenu(null); setQuick(m) }} className="min-h-[56px] px-4 rounded-[18px] bg-surface-2 text-left font-bold">Hızlı kalori ekle</button>
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
  const v = Number(g.replace(',', '.'))
  return (
    <div className="flex flex-col gap-4 pb-4">
      {!quick ? (
        <div className="flex items-center gap-3">
          <label htmlFor="ed-g" className="text-sm font-bold flex-1">Miktar (gram)</label>
          <input id="ed-g" inputMode="decimal" value={g} onChange={(e) => setG(e.target.value)} className="w-28 h-12 rounded-xl bg-surface-2 border border-line px-3 num text-lg text-right" />
        </div>
      ) : <p className="text-sm text-mute">Hızlı kalori kaydı: {fmtNum(item.kcal)} kcal</p>}
      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Öğün">
        {MEALS.map((x) => <button key={x.id} type="button" aria-pressed={meal === x.id} onClick={() => setMeal(x.id)} className={`h-10 rounded-full text-[13px] font-bold border ${meal === x.id ? 'bg-acc text-acc-ink border-acc' : 'bg-surface-2 text-ink-2 border-line'}`}>{x.label.replace(' yemeği', '')}</button>)}
      </div>
      <button type="button" disabled={!quick && !(v >= 1 && v <= 5000)} onClick={() => onSave({ grams: quick ? item.grams || 1 : v, portionLabel: quick ? null : '100 g', portionQty: quick ? null : v, meal })} className="h-14 rounded-full bg-acc text-acc-ink font-extrabold disabled:opacity-40">Kaydet</button>
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
