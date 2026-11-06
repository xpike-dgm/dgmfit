'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { programDays, setFavorite } from '@/lib/anatomy-data'
import { addExerciseToDay, getExercise } from '@/lib/fitness-data'

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string }

export async function favoriteAction(exerciseId: number, on: boolean): Promise<R> {
  const u = await requireUser()
  if (!Number.isInteger(exerciseId) || typeof on !== 'boolean') return { ok: false, error: 'Geçersiz hareket' }
  if (on && !(await getExercise(u.id, exerciseId))) return { ok: false, error: 'Hareket bulunamadı' }
  await setFavorite(u.id, exerciseId, on)
  revalidatePath('/fitness/kaydedilenler')
  return { ok: true }
}

export async function programDaysAction(): Promise<R<{ programs: Awaited<ReturnType<typeof programDays>> }>> {
  const u = await requireUser()
  return { ok: true, programs: await programDays(u.id) }
}

export async function addToDayAction(dayId: string, exerciseId: number): Promise<R> {
  const u = await requireUser()
  if (!/^[0-9a-f-]{36}$/i.test(dayId) || !Number.isInteger(exerciseId)) return { ok: false, error: 'Geçersiz seçim' }
  try { await addExerciseToDay(u.id, dayId, exerciseId) } catch (e) { return { ok: false, error: (e as Error).message || 'Eklenemedi' } }
  revalidatePath('/fitness')
  return { ok: true }
}
