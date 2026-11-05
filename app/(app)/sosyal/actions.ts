'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getUser, rateLimit } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { ITEMS, POST_KINDS, REACTIONS, type PostKind, type Reaction } from '@/lib/social'
import {
  acceptFriend, comment, copyWorkout, createPost, deleteComment, deletePost, dismissReport, follow, markAllRead, react, removeFriend, report,
  requestFriend, resolveComment, resolvePost, saveRecipeCopy, setBlock, setClose, toggleSave, updateSocialProfile,
} from '@/lib/social-data'
import { addMealItem } from '../yemek/actions'

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string }
const Uuid = z.string().uuid()
async function uid() { const u = await getUser(); if (!u) throw new Error('Oturum yok'); return u.id }
async function run<T extends object>(fn: () => Promise<T>, paths: string[] = ['/sosyal']): Promise<R<T>> {
  try { const r = await fn(); for (const p of paths) revalidatePath(p, 'layout'); return { ok: true, ...r } } catch (e) { return { ok: false, error: (e as Error).message || 'Bir hata oldu' } }
}

const PostIn = z.object({
  kind: z.enum(Object.keys(POST_KINDS) as [PostKind, ...PostKind[]]), body: z.string().max(2000), mediaIds: z.array(Uuid).max(4),
  audience: z.enum(['public', 'friends', 'selected']), audienceIds: z.array(Uuid).max(100), ref: z.string().max(80).nullable().optional(),
})
export async function createPostAction(input: z.input<typeof PostIn>): Promise<R<{ id: string; moderation: string; support: 'ed' | 'crisis' | null }>> {
  const p = PostIn.safeParse(input)
  if (!p.success) return { ok: false, error: 'Geçersiz gönderi' }
  const userId = await uid()
  if (!rateLimit('post:' + userId, 20, 3600_000)) return { ok: false, error: 'Saatte en fazla 20 gönderi' }
  return run(() => createPost(userId, p.data))
}
export async function deletePostAction(id: string): Promise<R> { if (!Uuid.safeParse(id).success) return { ok: false, error: 'Geçersiz' }; const me = await uid(); return run(async () => { await deletePost(me, id); return {} }) }

export async function reactAction(postId: string, kind: string | null): Promise<R> {
  if (!Uuid.safeParse(postId).success || (kind !== null && !(kind in REACTIONS))) return { ok: false, error: 'Geçersiz' }
  const me = await uid()
  return run(async () => { await react(me, postId, kind as Reaction | null); return {} }, [])
}
export async function commentAction(postId: string, body: string): Promise<R<{ pending: boolean }>> {
  if (!Uuid.safeParse(postId).success) return { ok: false, error: 'Geçersiz' }
  const me = await uid()
  if (!rateLimit('comment:' + me, 60, 3600_000)) return { ok: false, error: 'Çok fazla yorum; biraz bekle' }
  return run(() => comment(me, postId, body), [`/sosyal/p/${postId}`])
}
export async function deleteCommentAction(id: string, postId: string): Promise<R> { const me = await uid(); return run(async () => { await deleteComment(me, id); return {} }, [`/sosyal/p/${postId}`]) }
export async function saveAction(postId: string, on: boolean): Promise<R> { const me = await uid(); return run(async () => { await toggleSave(me, postId, on); return {} }, []) }
export async function copyWorkoutAction(postId: string): Promise<R<{ id: string }>> { const me = await uid(); return run(async () => ({ id: await copyWorkout(me, postId) }), ['/fitness']) }
export async function saveRecipeAction(postId: string): Promise<R<{ foodId: number }>> { const me = await uid(); return run(async () => ({ foodId: await saveRecipeCopy(me, postId) }), ['/yemek']) }
/** "Öğün olarak ekle": önce tarifin kopyası kaydedilir (yazarın besini izleyiciye özel değildir), sonra 1 porsiyon günlüğe eklenir. */
export async function addRecipeMealAction(postId: string, meal: string): Promise<R<{ kcal: number }>> {
  const m = z.enum(['breakfast', 'lunch', 'dinner', 'snack']).safeParse(meal)
  if (!m.success) return { ok: false, error: 'Öğün seç' }
  const me = await uid()
  try {
    const foodId = await saveRecipeCopy(me, postId)
    const { db, schema } = await import('@/lib/db')
    const { eq } = await import('drizzle-orm')
    const [f] = await db.select({ portions: schema.foods.portions }).from(schema.foods).where(eq(schema.foods.id, foodId)).limit(1)
    const g = f?.portions[0]?.g ?? 100
    const r = await addMealItem({ foodId, grams: Math.round(g), portionLabel: f?.portions[0]?.label ?? null, portionQty: 1, meal: m.data, source: 'recipe' })
    return r.ok ? { ok: true, kcal: r.kcal } : { ok: false, error: r.error }
  } catch (e) { return { ok: false, error: (e as Error).message } }
}

export async function friendAction(input: { op: 'request' | 'accept' | 'remove' | 'close' | 'unclose' | 'follow' | 'unfollow' | 'block' | 'unblock' | 'mute' | 'unmute'; username?: string; id?: string }): Promise<R<{ result?: string }>> {
  const me = await uid()
  if (!rateLimit('friend:' + me, 60, 3600_000)) return { ok: false, error: 'Çok fazla işlem; biraz bekle' }
  const id = input.id && Uuid.safeParse(input.id).success ? input.id : null
  return run(async () => {
    switch (input.op) {
      case 'request': return { result: await requestFriend(me, String(input.username ?? '')) }
      case 'accept': await acceptFriend(me, id!); break
      case 'remove': await removeFriend(me, id!); break
      case 'close': case 'unclose': await setClose(me, id!, input.op === 'close'); break
      case 'follow': case 'unfollow': await follow(me, id!, input.op === 'follow'); break
      case 'block': case 'unblock': await setBlock(me, id!, 'block', input.op === 'block'); break
      case 'mute': case 'unmute': await setBlock(me, id!, 'mute', input.op === 'mute'); break
    }
    return {}
  }, ['/sosyal', '/u'])
}

const ProfIn = z.object({
  bio: z.string().trim().max(200).nullable(), gym: z.string().trim().max(60).nullable(), visibility: z.enum(['public', 'friends', 'private']),
  items: z.record(z.enum(ITEMS), z.enum(['none', 'friends', 'public'])), showGoal: z.boolean(), showcase: z.array(z.number().int().positive()).max(6),
  notify: z.record(z.string(), z.boolean()), avatarId: Uuid.nullable().optional(),
})
export async function saveProfileAction(input: z.input<typeof ProfIn>): Promise<R> {
  const p = ProfIn.safeParse(input)
  if (!p.success) return { ok: false, error: 'Geçersiz ayar' }
  const me = await uid()
  return run(async () => { await updateSocialProfile(me, { ...p.data, bio: p.data.bio || null, gym: p.data.gym || null }); return {} }, ['/sosyal', '/u'])
}

export async function reportAction(input: { targetType: 'post' | 'comment' | 'user'; targetId: string; reason: string; note?: string }): Promise<R> {
  const p = z.object({ targetType: z.enum(['post', 'comment', 'user']), targetId: z.string().max(60), reason: z.enum(['taciz', 'uygunsuz', 'zararlı diyet', 'spam', 'diğer']), note: z.string().max(300).optional() }).safeParse(input)
  if (!p.success) return { ok: false, error: 'Şikayet nedeni seç' }
  const me = await uid()
  if (!rateLimit('report:' + me, 20, 3600_000)) return { ok: false, error: 'Çok fazla şikayet' }
  return run(async () => { await report(me, p.data.targetType, p.data.targetId, p.data.reason, p.data.note ?? null); return {} }, [])
}
export async function readAllAction(): Promise<R> { const me = await uid(); return run(async () => { await markAllRead(me); return {} }) }

async function admin() { const u = await getUser(); if (!u || !isAdmin(u.username)) throw new Error('Yetki yok'); return u }
export async function moderateAction(input: { type: 'post' | 'comment' | 'report'; id: string; approve: boolean }): Promise<R> {
  await admin()
  if (!Uuid.safeParse(input.id).success) return { ok: false, error: 'Geçersiz' }
  return run(async () => {
    if (input.type === 'post') await resolvePost(input.id, input.approve)
    else if (input.type === 'comment') await resolveComment(input.id, input.approve)
    else await dismissReport(input.id)
    return {}
  }, ['/yonetim/moderasyon', '/sosyal'])
}
