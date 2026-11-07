// Özelleştirme Ö3c: topluluk kuralları (saf; testleri tests/cards-community.test.ts) — yarışma, oy, duyuru, link.
import { weekKey } from './templates.ts'

/** Yarışma durumu: kendi haftasında açık (katılım + oy), sonra kapalı (kazanan belli). */
export function contestOpen(contestWeek: string, today: string): boolean { return weekKey(today) === contestWeek }

export interface EntryVotes { templateId: string; userId: string; votes: number; createdAt: Date }
/** Kazanan: en çok oy; eşitlikte önce katılan. Hiç oy yoksa kazanan yok. */
export function contestWinner<T extends EntryVotes>(entries: T[]): T | null {
  const best = [...entries].sort((a, b) => b.votes - a.votes || a.createdAt.getTime() - b.createdAt.getTime())[0]
  return best && best.votes > 0 ? best : null
}

/** Oy hakkı: yarışma açık, katılımcı kendi şablonuna oy veremez (oy değiştirilebilir, kişi başı tek oy). */
export function voteError(o: { open: boolean; voterId: string; entryOwnerId: string }): string | null {
  if (!o.open) return 'Yarışma kapandı'
  if (o.voterId === o.entryOwnerId) return 'Kendi tasarımına oy veremezsin'
  return null
}

export interface Announcement { id: string; title: string; active: boolean; endsAt: Date | null; createdAt: Date }
/** Gösterilecek duyuru: etkin, süresi geçmemiş, kullanıcının kapatmadığı en yeni duyuru. */
export function visibleAnnouncement<T extends Announcement>(list: T[], dismissed: Set<string>, now: Date): T | null {
  return list.filter((a) => a.active && (!a.endsAt || a.endsAt > now) && !dismissed.has(a.id)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
}

/** Duyuru bağlantısı yalnız uygulama içi yol ya da https olabilir (javascript: vb. reddedilir). */
export function safeUrl(u: string | null | undefined): string | null {
  const s = (u ?? '').trim()
  if (!s) return null
  if (/^\/(?!\/)[\w\-./?=&%#]*$/.test(s)) return s
  try { const x = new URL(s); return x.protocol === 'https:' ? x.toString() : null } catch { return null }
}

/** Girişsiz önizleme bağlantısı (kök adres + /t/ + kimlik). */
export const publicTemplateUrl = (origin: string, id: string) => `${origin.replace(/\/+$/, '')}/t/${id}`
