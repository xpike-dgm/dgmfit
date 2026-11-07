import 'server-only'
// Özelleştirme (Ö1): kullanıcının etkin tasarımı. Tek etkin tasarım (ui_designs_one_active); çoklu tasarım ve sürümler Ö3'te
// aynı tabloyu kullanır.
import { cache } from 'react'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db, schema } from '../db'
import { publish } from '../events'
import { isAdvanced } from '../ui-mode'
import { dayString } from '../time'
import { minuteOfDay } from '../water-data'
import { trainingWeekdays } from '../fit'
import { REGISTRY_VERSION, SCREENS, cardDef, quickOf, type ScreenId } from './registry'
import { emptyDesign, normalizeScreen, resolveScreen, type Design, type LayoutItem, type ResolvedItem } from './layout'
import { applyGestures, applyRules, goalFront, normalizeNav, normalizePrefs, normalizeRules, setHiddenToday, setPin, type NavLayout, type Rule, type RuleCtx, type UsePrefs } from './prefs'
import { mergeRules, wizardDesign, type WizardAnswers } from './wizard'
import { normalizeCardColors, normalizeModuleColors, type CardColors, type ModuleColors } from './colors'
import { normalizeStyle, type StylePrefs } from './style'
import type { UserCard } from './custom'

/** İstek başına bir sorgu (alt bar, düzen ve stüdyo aynı istekte okur). */
export const activeDesign = cache(async (userId: string): Promise<Design | null> => {
  const [row] = await db.select({ data: schema.uiDesigns.data }).from(schema.uiDesigns)
    .where(and(eq(schema.uiDesigns.userId, userId), eq(schema.uiDesigns.active, true))).limit(1)
  return row ? (row.data as unknown as Design) : null
})

type Goal = RuleCtx['goal']
export const userGoal = cache(async (userId: string): Promise<Goal> => {
  const [g] = await db.select({ type: schema.goals.type }).from(schema.goals).where(and(eq(schema.goals.userId, userId), eq(schema.goals.active, true))).limit(1)
  return g && ['lose', 'gain', 'recomp'].includes(g.type) ? (g.type as Goal) : null
})

/** Kuralların koşul bağlamı: saat/gün (İstanbul), antrenman günü (planlı gün ya da bugün antrenman kaydı), hedef. */
export const ruleCtx = cache(async (userId: string): Promise<RuleCtx> => {
  const day = dayString()
  const weekday = new Date(day + 'T12:00:00Z').getUTCDay()
  const [goal, [p], [cc], [w]] = await Promise.all([
    userGoal(userId),
    db.select({ n: schema.profiles.trainingDays }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1),
    db.select({ on: schema.carbCycle.enabled, days: schema.carbCycle.weekdays }).from(schema.carbCycle).where(eq(schema.carbCycle.userId, userId)).limit(1),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.workouts).where(and(eq(schema.workouts.userId, userId), eq(schema.workouts.day, day), isNull(schema.workouts.deletedAt))),
  ])
  const planned = p?.n ? trainingWeekdays(p.n, cc?.on ? cc.days : null).includes(weekday) : false
  return { minute: minuteOfDay(new Date()), weekday, training: planned || Number(w?.n ?? 0) > 0, goal }
})

/**
 * Ekranın çözülmüş düzeni (göç + doğrulama). Tasarımı olmayan kullanıcı hedefine göre sıralanmış varsayılanı alır.
 * Düzenlemede kurallar uygulanmaz (kullanıcı kayıtlı düzenini görür); normal görünümde `applied` uygulanan kural adlarıdır.
 */
export async function screenLayout(userId: string, screen: ScreenId, opts: { editing?: boolean } = {}) {
  const [d, advanced, goal] = await Promise.all([activeDesign(userId), isAdvanced(userId), userGoal(userId)])
  const r = await withAdminDefault(resolveScreen(d, screen, { advanced }), screen, advanced)
  if (!r.customized) r.items = goalFront(screen, r.items, goal)
  let applied: string[] = []
  let pinned: string[] = []
  let hiddenToday: string[] = []
  if (!opts.editing && d?.rules?.some((x) => x.on)) {
    const x = await ruleCtx(userId)
    const out = applyRules(screen, r.items, d.rules, x, (id): ResolvedItem | null => { const def = cardDef(id); return def ? { id, size: def.size, def } : null })
    if (out.applied.length) {
      r.items = out.items; applied = out.applied
      const shown = new Set(r.items.map((i) => i.id))
      r.drawer = r.drawer.filter((i) => !shown.has(i.def.id))
    }
  }
  // Ö1b-3: kaydırma hareketleri (sabitle, bugünlük gizle) — düzenlemede yalnız sabit listesi bilgi olarak döner
  if (d?.gestures) {
    const g = applyGestures(screen, r.items, d.gestures, dayString())
    if (!opts.editing) { r.items = g.items; hiddenToday = g.hiddenToday }
    pinned = opts.editing ? (d.gestures.pins?.[screen] ?? []) : g.pinned
  }
  // Ö1b-3: kart ayarları (hızlı eylem); kart çizicileri `quick[id]` ile okur
  const quick: Record<string, string> = {}
  for (const c of r.items) { const q = quickOf(c.id, d?.cards?.[c.id]?.quick); if (q) quick[c.id] = q }
  // Ö2a: kart renkleri (yığındakiler dahil; düzenlemede çekmecedekiler de, eklenince renkleriyle gelsin)
  const colors: Record<string, CardColors> = {}
  const ids = [...r.items.flatMap((i) => [i.id, ...(i.stack ?? [])]), ...(opts.editing ? r.drawer.map((x) => x.def.id) : [])]
  for (const id of ids) { const c = normalizeCardColors(d?.cards?.[id]?.colors); if (c) colors[id] = c }
  // Ö5a: kendi kartlarım — ekrandaki (ve düzenlemede çekmecedeki) kullanıcı kartlarının tanımları ve adları
  const userCards: Record<string, UserCard> = {}
  const titles: Record<string, string> = {}
  for (const id of ids) { const u = d?.userCards?.[id]; if (u) { userCards[id] = u; titles[id] = u.title } }
  return { ...r, applied, pinned, hiddenToday, quick, colors, userCards, titles }
}

/** Tüm ekranların çözülmüş düzeni (stüdyo listesi için; kurallar uygulanmaz). */
export async function allScreenLayouts(userId: string) {
  const [d, advanced, goal] = await Promise.all([activeDesign(userId), isAdvanced(userId), userGoal(userId)])
  const out = {} as Record<ScreenId, ReturnType<typeof resolveScreen>>
  for (const s of Object.keys(SCREENS) as ScreenId[]) {
    const r = await withAdminDefault(resolveScreen(d, s, { advanced }), s, advanced)
    if (!r.customized) r.items = goalFront(s, r.items, goal)
    out[s] = r
  }
  return out
}

async function writeDesign(userId: string, d: Design, note?: string, prev?: Design | null) {
  const data = { ...d, v: REGISTRY_VERSION } as unknown as Record<string, unknown>
  let [row] = await db.update(schema.uiDesigns).set({ data, updatedAt: new Date() })
    .where(and(eq(schema.uiDesigns.userId, userId), eq(schema.uiDesigns.active, true))).returning({ id: schema.uiDesigns.id })
  if (!row) [row] = await db.insert(schema.uiDesigns).values({ userId, data, active: true }).onConflictDoNothing().returning({ id: schema.uiDesigns.id })
  if (row && note) await snapshot(userId, row.id, data, note, prev ? ({ ...prev, v: REGISTRY_VERSION } as unknown as Record<string, unknown>) : undefined)
}

const SNAP_MERGE_MS = 10 * 60_000
export const SNAP_KEEP = 30
/** Ö3a: sürüm anlık görüntüsü. Aynı notla 10 dk içindeki ardışık kayıtlar tek sürümde birleşir; tasarım başına en çok 30 sürüm. */
export async function snapshot(userId: string, designId: string, data: Record<string, unknown>, note: string, prev?: Record<string, unknown>) {
  const [last] = await db.select({ id: schema.uiDesignVersions.id, note: schema.uiDesignVersions.note, at: schema.uiDesignVersions.createdAt })
    .from(schema.uiDesignVersions).where(eq(schema.uiDesignVersions.designId, designId)).orderBy(desc(schema.uiDesignVersions.createdAt)).limit(1)
  // ilk sürümden önce değişiklik öncesi hâl "Başlangıç" olarak saklanır (ilk değişiklik de geri alınabilsin)
  if (!last && prev) await db.insert(schema.uiDesignVersions).values({ designId, userId, note: 'Başlangıç', data: prev, createdAt: new Date(Date.now() - 1000) })
  if (last && last.note === note && Date.now() - last.at.getTime() < SNAP_MERGE_MS) {
    await db.update(schema.uiDesignVersions).set({ data, createdAt: new Date() }).where(eq(schema.uiDesignVersions.id, last.id))
  } else {
    await db.insert(schema.uiDesignVersions).values({ designId, userId, note, data })
  }
  await db.execute(sql`delete from ui_design_versions where design_id = ${designId} and id not in (select id from ui_design_versions where design_id = ${designId} order by created_at desc limit ${SNAP_KEEP})`)
}
/** Etkin tasarımı okuyup değiştirir (istek önbelleğindeki değil, güncel satır). */
async function updateDesign(userId: string, f: (d: Design) => Design, note?: string) {
  const [row] = await db.select({ data: schema.uiDesigns.data }).from(schema.uiDesigns)
    .where(and(eq(schema.uiDesigns.userId, userId), eq(schema.uiDesigns.active, true))).limit(1)
  const prev = row ? (row.data as unknown as Design) : null
  const next = f(prev ?? emptyDesign())
  await writeDesign(userId, next, note, prev ?? emptyDesign())
  return next
}

/** Ekran düzenini kaydeder (sunucuda yeniden doğrulanır: bilinmeyen kart, tekrar, kilitli kart). */
export async function saveScreen(userId: string, screen: ScreenId, items: LayoutItem[], settings: Record<string, { quick?: string; colors?: CardColors | null }> = {}) {
  const advanced = await isAdvanced(userId)
  const next = await updateDesign(userId, (cur) => {
    const cards = { ...(cur.cards ?? {}) }
    for (const [id, st] of Object.entries(settings)) {
      if (cardDef(id)?.screen !== screen) continue
      if (st.quick !== undefined) { const q = quickOf(id, st.quick); if (q) cards[id] = { ...cards[id], quick: q } }
      if (st.colors !== undefined && cardDef(id)?.colorSlots) {
        const c = st.colors ? normalizeCardColors(st.colors) : undefined
        const { colors: _old, ...rest } = cards[id] ?? {}
        cards[id] = c ? { ...rest, colors: c as Record<string, string> } : rest
      }
    }
    return { ...cur, cards, screens: { ...cur.screens, [screen]: normalizeScreen(screen, items, { advanced }, cur.userCards) } }
  }, `${SCREENS[screen].title} düzeni`)
  await publish(userId, 'design.saved', { screen, cards: next.screens[screen]!.items.length })
}

/** Ekranı varsayılana döndürür (o ekranın kaydı silinir; kart ayarları, kurallar ve alt bar korunur). */
export async function resetScreen(userId: string, screen: ScreenId) {
  await updateDesign(userId, (cur) => { const screens = { ...cur.screens }; delete screens[screen]; return { ...cur, screens } }, `${SCREENS[screen].title} varsayılana döndü`)
  await publish(userId, 'design.reset', { screen })
}

export async function saveNav(userId: string, nav: NavLayout | null) {
  const n = nav ? normalizeNav(nav) : null
  await updateDesign(userId, (cur) => { const d = { ...cur }; if (n) d.nav = n; else delete d.nav; return d }, 'Alt bar')
  await publish(userId, 'design.nav', { hidden: n?.hidden?.length ?? 0 })
}

export async function saveRules(userId: string, rules: Rule[]) {
  const r = normalizeRules(rules)
  await updateDesign(userId, (cur) => ({ ...cur, rules: r }), 'Kurallar')
  await publish(userId, 'design.rules', { rules: r.length, on: r.filter((x) => x.on).length })
  return r
}

export async function savePrefs(userId: string, p: UsePrefs) {
  const n = normalizePrefs(p)
  await updateDesign(userId, (cur) => ({ ...cur, prefs: n }), 'Kullanım ayarları')
  await publish(userId, 'design.prefs', { hand: n.hand ?? 'none', holdToEdit: n.holdToEdit ?? true })
}

// ───────── Ö1b-3: kaydırma hareketleri ve sihirbaz ─────────
export async function pinCard(userId: string, id: string, on: boolean) {
  await updateDesign(userId, (cur) => ({ ...cur, gestures: setPin(cur.gestures ?? {}, id, on) }))
  await publish(userId, 'design.gesture', { kind: on ? 'pin' : 'unpin', card: id })
}
export async function hideCardToday(userId: string, id: string, on: boolean) {
  await updateDesign(userId, (cur) => ({ ...cur, gestures: setHiddenToday(cur.gestures ?? {}, id, on, dayString()) }))
  await publish(userId, 'design.gesture', { kind: on ? 'hide-today' : 'unhide-today', card: id })
}

/** Sihirbaz sonucunu uygular: Bugün düzeni, alt bar, tek el; hazır kurallar mevcutlara eklenir. Diğer ekranlar korunur. */
export async function applyWizard(userId: string, a: WizardAnswers) {
  const w = wizardDesign(a)
  const advanced = await isAdvanced(userId)
  await updateDesign(userId, (cur) => ({
    ...cur,
    screens: { ...cur.screens, today: normalizeScreen('today', w.today, { advanced }, cur.userCards) },
    nav: normalizeNav(w.nav),
    prefs: normalizePrefs({ ...(cur.prefs ?? {}), hand: w.hand }),
    rules: normalizeRules(mergeRules(cur.rules ?? [], w.rules)),
  }), 'Düzen sihirbazı')
  await publish(userId, 'design.wizard', { focus: a.focus, detail: a.detail, hand: a.hand, time: a.time, logs: a.logs.join(',') })
  return w
}

// ───────── Ö2a: modül renkleri ─────────
export async function saveModules(userId: string, mc: ModuleColors | null) {
  const n = mc ? normalizeModuleColors(mc) : undefined
  await updateDesign(userId, (cur) => { const d = { ...cur }; if (n) d.modules = n; else delete d.modules; return d }, 'Modül renkleri')
  await publish(userId, 'design.colors', { modules: n ? Object.keys(n).length : 0 })
}

// ───────── Ö2b: stil ─────────
/** Kullanıcının stil tercihleri (birimler dahil); istek başına tasarım önbelleğinden. */
export async function userStyle(userId: string): Promise<StylePrefs> { return normalizeStyle((await activeDesign(userId))?.style) }

export async function saveStyle(userId: string, patch: Partial<StylePrefs>) {
  let out: StylePrefs | null = null
  await updateDesign(userId, (cur) => { out = normalizeStyle({ ...normalizeStyle(cur.style), ...patch, units: { ...normalizeStyle(cur.style).units, ...(patch.units ?? {}) } }); return { ...cur, style: out } }, 'Stil')
  await publish(userId, 'design.style', { keys: Object.keys(patch).join(',') })
  return out!
}

/** Ö3b: etkin tasarımı bir dönüşümle değiştirir (şablon uygulama); sürüm notu ile. */
export async function transformDesign(userId: string, f: (d: Design) => Design, note?: string) { return updateDesign(userId, f, note) }

/** Ö3c: yönetimden varsayılan düzen — özelleştirmemiş kullanıcıda kayıttaki varsayılanın yerine geçer (customized değişmez). */
async function withAdminDefault(r: ReturnType<typeof resolveScreen>, screen: ScreenId, advanced: boolean) {
  if (r.customized) return r
  const { layoutDefaults } = await import('./community-data')
  const def = (await layoutDefaults())[screen]
  if (!def) return r
  const x = resolveScreen({ v: REGISTRY_VERSION, screens: { [screen]: def } }, screen, { advanced })
  return { ...x, notices: [], customized: false, drawer: x.drawer.map((i) => (i.reason === 'removed' ? { ...i, reason: 'available' as const } : i)) }
}
