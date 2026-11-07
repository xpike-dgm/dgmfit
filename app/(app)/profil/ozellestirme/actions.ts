'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser, rateLimit } from '@/lib/auth'
import { SCREENS, isScreen } from '@/lib/cards/registry'
import { resetScreen, saveScreen } from '@/lib/cards/design-data'

type R = { ok: true } | { ok: false; error: string }
const Items = z.array(z.object({ id: z.string().min(1).max(60), size: z.enum(['half', 'full']).optional() })).max(60)

/** Özelleştirme: ekran düzenini kaydet (sunucu kart kaydına göre yeniden doğrular). */
export async function saveLayoutAction(screen: string, items: unknown): Promise<R> {
  const u = await requireUser()
  const p = Items.safeParse(items)
  if (!isScreen(screen) || !p.success) return { ok: false, error: 'Geçersiz düzen' }
  if (!rateLimit('design:' + u.id, 60, 3600_000)) return { ok: false, error: 'Çok sık kaydedildi; biraz sonra dene' }
  await saveScreen(u.id, screen, p.data)
  revalidatePath(SCREENS[screen].path); revalidatePath('/profil/ozellestirme')
  return { ok: true }
}

export async function resetLayoutAction(screen: string): Promise<R> {
  const u = await requireUser()
  if (!isScreen(screen)) return { ok: false, error: 'Geçersiz ekran' }
  await resetScreen(u.id, screen)
  revalidatePath(SCREENS[screen].path); revalidatePath('/profil/ozellestirme')
  return { ok: true }
}
