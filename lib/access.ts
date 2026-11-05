// Beyaz liste kuralları (saf; testli).

export const USER_STATUS = {
  pending: { label: 'Onay bekliyor', tone: 'warn' },
  approved: { label: 'Onaylı', tone: 'good' },
  rejected: { label: 'Reddedildi', tone: 'danger' },
  suspended: { label: 'Askıda', tone: 'danger' },
} as const
export type UserStatus = keyof typeof USER_STATUS
export const isStatus = (s: string): s is UserStatus => s in USER_STATUS

/** Uygulamaya girebilir mi? Yöneticiler durumdan bağımsız girer (kendini kilitleyemez). */
export function canEnter(status: string, admin: boolean): boolean {
  return admin || status === 'approved'
}

export interface InviteLike { maxUses: number | null; uses: number; expiresAt: Date | null; disabled: boolean }
/** Davet kodu kullanılabilir mi? */
export function inviteUsable(i: InviteLike | null | undefined, now: Date): boolean {
  if (!i || i.disabled) return false
  if (i.expiresAt && i.expiresAt <= now) return false
  if (i.maxUses !== null && i.uses >= i.maxUses) return false
  return true
}

/** Davet kodu biçimi: büyük harf/rakam, okunaklı (0/O, 1/I yok). */
export const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function normalizeInvite(s: string): string {
  return s.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 64)
}

export const FEEDBACK_KINDS = {
  oneri: { label: 'Öneri / istek', hint: 'Eklenmesini istediğin bir şey' },
  hata: { label: 'Hata', hint: 'Çalışmayan ya da yanlış görünen bir şey' },
  sikayet: { label: 'Şikayet', hint: 'Memnun olmadığın bir durum' },
  diger: { label: 'Diğer', hint: 'Soru, teşekkür, başka bir konu' },
} as const
export type FeedbackKind = keyof typeof FEEDBACK_KINDS
export const FEEDBACK_AREAS = ['Bugün', 'Fitness', 'Fit', 'Yemek', 'Su', 'Sosyal', 'AI koç', 'Profil / ayarlar', 'Genel'] as const
export const FEEDBACK_STATUS = { new: 'Yeni', seen: 'İnceleniyor', done: 'Çözüldü' } as const
export type FeedbackStatus = keyof typeof FEEDBACK_STATUS
