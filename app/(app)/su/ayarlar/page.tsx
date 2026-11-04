import type { Metadata } from 'next'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'
import { db, schema } from '@/lib/db'
import { ensureWaterSetup, goalHistory } from '@/lib/water-data'
import { DEFAULT_BUTTONS, sipMl } from '@/lib/water'
import { waterTarget } from '@/lib/calc'
import { TopBar } from '@/components/ui'
import SettingsForm from './SettingsForm'
import PushSettings from './PushSettings'
import FoodWaterToggle from './FoodWaterToggle'

export const metadata: Metadata = { title: 'Su ayarları' }

export default async function Page() {
  const u = await requireUser()
  await ensureWaterSetup(u.id)
  const [[settings], containers, history, [profile]] = await Promise.all([
    db.select().from(schema.waterSettings).where(eq(schema.waterSettings.userId, u.id)).limit(1),
    db.select().from(schema.waterContainers).where(and(eq(schema.waterContainers.userId, u.id), isNull(schema.waterContainers.archivedAt))).orderBy(asc(schema.waterContainers.sort), asc(schema.waterContainers.createdAt)),
    goalHistory(u.id),
    db.select({ weightKg: schema.profiles.weightKg }).from(schema.profiles).where(eq(schema.profiles.userId, u.id)).limit(1),
  ])
  const last = history.at(-1)
  return (
    <div className="px-4 pt-4 flex flex-col gap-3">
      <TopBar back="/su" title="Su ayarları" />
      <div className="mt-2">
        <PushSettings enabled={settings?.remindersEnabled ?? false} summaryEnabled={settings?.summaryEnabled ?? true} maxPerDay={settings?.maxPerDay ?? 8} quiet={settings?.quiet ?? []} />
      </div>
      <FoodWaterToggle on={settings?.foodWater ?? false} />
      <SettingsForm
        goal={{ baseMl: last?.baseMl ?? 2500, weekday: last?.weekday ?? [null, null, null, null, null, null, null] }}
        suggested={profile ? waterTarget(profile.weightKg) : 2500}
        buttons={settings?.buttons?.length ? settings.buttons : DEFAULT_BUTTONS}
        containers={containers.map((c) => ({ id: c.id, name: c.name, kind: c.kind, capacityMl: c.capacityMl, isDefault: c.isDefault }))}
        sip={{ ml: sipMl(settings?.sipMl), calibrated: !!settings?.sipMl }}
        progressStyle={settings?.progressStyle ?? 'bottle'}
        feedback={settings?.feedback ?? true}
      />
    </div>
  )
}
