import 'server-only'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { ensureWaterSetup, goalHistory } from '@/lib/water-data'
import { DEFAULT_BUTTONS, sipMl } from '@/lib/water'
import { waterTarget } from '@/lib/calc'

/** Su ayar sayfalarının ortak verisi (menü ve her alt sayfa aynı kaynaktan okur). */
export async function waterSettingsData(userId: string) {
  await ensureWaterSetup(userId)
  const [[settings], containers, history, [profile]] = await Promise.all([
    db.select().from(schema.waterSettings).where(eq(schema.waterSettings.userId, userId)).limit(1),
    db.select().from(schema.waterContainers).where(and(eq(schema.waterContainers.userId, userId), isNull(schema.waterContainers.archivedAt))).orderBy(asc(schema.waterContainers.sort), asc(schema.waterContainers.createdAt)),
    goalHistory(userId),
    db.select({ weightKg: schema.profiles.weightKg }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1),
  ])
  const last = history.at(-1)
  return {
    settings,
    form: {
      goal: { baseMl: last?.baseMl ?? 2500, weekday: last?.weekday ?? [null, null, null, null, null, null, null] },
      suggested: profile ? waterTarget(profile.weightKg) : 2500,
      buttons: settings?.buttons?.length ? settings.buttons : DEFAULT_BUTTONS,
      containers: containers.map((c) => ({ id: c.id, name: c.name, kind: c.kind, capacityMl: c.capacityMl, isDefault: c.isDefault })),
      sip: { ml: sipMl(settings?.sipMl), calibrated: !!settings?.sipMl },
      progressStyle: settings?.progressStyle ?? 'ring',
      feedback: settings?.feedback ?? true,
    },
  }
}
