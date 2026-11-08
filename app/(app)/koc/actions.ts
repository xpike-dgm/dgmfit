'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getUser } from '@/lib/auth'
import { AiError } from '@/lib/ai/engine'
import { PERSONAS, type Persona } from '@/lib/ai/schemas'
import { applyCoachAction, deleteConversation, dismissInsight, saveCoachPrefs, sendCoachMessage, type MessageView, type StoredAction } from '@/lib/coach-data'
import { addWater } from '../su/actions'

async function uid() { const u = await getUser(); if (!u) throw new Error('Oturum yok'); return u.id }

export async function sendCoachAction(input: { conversationId: string | null; text: string }): Promise<{ ok: true; conversationId: string; user: MessageView; reply: MessageView; calls: number; memories: { id: string; text: string }[] } | { ok: false; error: string }> {
  const p = z.object({ conversationId: z.string().uuid().nullable(), text: z.string().trim().min(2).max(1000) }).safeParse(input)
  if (!p.success) return { ok: false, error: 'Mesaj 2–1000 karakter olmalı' }
  try {
    const r = await sendCoachMessage(await uid(), p.data.conversationId, p.data.text)
    return { ok: true, ...r }
  } catch (e) {
    if (e instanceof AiError) return { ok: false, error: e.message }
    console.error('[dgfit] koç hatası', e)
    return { ok: false, error: 'Koç şu an yanıt veremedi. Biraz sonra tekrar dene.' }
  }
}

export async function coachDecisionAction(input: { messageId: string; index: number; decision: 'confirm' | 'cancel' }): Promise<{ ok: true; action: StoredAction } | { ok: false; error: string }> {
  const p = z.object({ messageId: z.string().uuid(), index: z.number().int().min(0).max(2), decision: z.enum(['confirm', 'cancel']) }).safeParse(input)
  if (!p.success) return { ok: false, error: 'Geçersiz istek' }
  try {
    const action = await applyCoachAction(await uid(), p.data.messageId, p.data.index, p.data.decision, async (ml, drink) => {
      const r = await addWater({ ml, drink: drink as never, source: 'voice', force: true })
      return r.ok ? { ok: true } : { ok: false, error: r.error }
    })
    revalidatePath('/'); revalidatePath('/fit'); revalidatePath('/fitness')
    return { ok: true, action }
  } catch (e) { return { ok: false, error: (e as Error).message } }
}

export async function deleteConversationAction(id: string): Promise<{ ok: boolean }> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false }
  await deleteConversation(await uid(), id)
  revalidatePath('/koc')
  return { ok: true }
}

export async function saveCoachPrefsAction(input: { persona: string; insights: boolean; weeklyPush: boolean; nudges?: boolean }): Promise<{ ok: boolean }> {
  const p = z.object({ persona: z.enum(Object.keys(PERSONAS) as [Persona, ...Persona[]]), insights: z.boolean(), weeklyPush: z.boolean(), nudges: z.boolean().optional() }).safeParse(input)
  if (!p.success) return { ok: false }
  await saveCoachPrefs(await uid(), p.data)
  revalidatePath('/koc'); revalidatePath('/')
  return { ok: true }
}

export async function dismissInsightAction(id: string): Promise<{ ok: boolean }> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false }
  await dismissInsight(await uid(), id)
  return { ok: true }
}

/** Y2: koçun kalıcı notunu sil. */
export async function deleteMemoryAction(id: string): Promise<{ ok: boolean }> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false }
  const { deleteMemory } = await import('@/lib/coach-data')
  await deleteMemory(await uid(), id)
  revalidatePath('/koc')
  return { ok: true }
}
