import 'server-only'
import crypto from 'node:crypto'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db, schema } from './db'

/** AES-256-GCM. Anahtar sunucuda DGFIT_MEDIA_KEY (32 bayt, base64); yoksa fotoğraf özelliği kapalıdır. */
function key(): Buffer | null {
  const k = process.env.DGFIT_MEDIA_KEY
  if (!k) return null
  const b = Buffer.from(k, 'base64')
  return b.length === 32 ? b : null
}
export const mediaEnabled = () => key() !== null
export const MAX_BYTES = 3 * 1024 * 1024
const MIME = new Set(['image/jpeg', 'image/webp', 'image/png'])

/** Dosya imzasından tür: istemcinin bildirdiği türe güvenilmez. */
export function sniff(b: Buffer): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  return null
}

export async function saveMedia(userId: string, i: { kind: 'progress' | 'exercise'; day: string; pose: string | null; data: Buffer }) {
  const k = key()
  if (!k) throw new Error('Fotoğraf saklama sunucuda yapılandırılmamış')
  if (i.data.length > MAX_BYTES) throw new Error('Fotoğraf 3 MB\'tan büyük')
  const mime = sniff(i.data)
  if (!mime || !MIME.has(mime)) throw new Error('Yalnızca JPEG, PNG ya da WebP')
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', k, iv)
  c.setAAD(Buffer.from(userId))
  const data = Buffer.concat([c.update(i.data), c.final()])
  const [row] = await db.insert(schema.mediaBlobs).values({ userId, kind: i.kind, day: i.day, pose: i.pose, mime, iv, tag: c.getAuthTag(), data, bytes: i.data.length }).returning({ id: schema.mediaBlobs.id })
  return row.id
}

/** Sahibine ait medyayı çözer; başkasının kimliği verilirse null (varlığı bile sızdırılmaz). */
export async function readMedia(userId: string, id: string): Promise<{ mime: string; data: Buffer } | null> {
  const k = key()
  if (!k) return null
  const [m] = await db.select().from(schema.mediaBlobs).where(and(eq(schema.mediaBlobs.id, id), eq(schema.mediaBlobs.userId, userId), isNull(schema.mediaBlobs.deletedAt))).limit(1)
  if (!m) return null
  const d = crypto.createDecipheriv('aes-256-gcm', k, m.iv)
  d.setAAD(Buffer.from(userId))
  d.setAuthTag(m.tag)
  return { mime: m.mime, data: Buffer.concat([d.update(m.data), d.final()]) }
}

export async function listProgressPhotos(userId: string) {
  return db.select({ id: schema.mediaBlobs.id, day: schema.mediaBlobs.day, pose: schema.mediaBlobs.pose, bytes: schema.mediaBlobs.bytes })
    .from(schema.mediaBlobs).where(and(eq(schema.mediaBlobs.userId, userId), eq(schema.mediaBlobs.kind, 'progress'), isNull(schema.mediaBlobs.deletedAt))).orderBy(desc(schema.mediaBlobs.day), desc(schema.mediaBlobs.createdAt))
}

export async function deleteMedia(userId: string, id: string) {
  // içerik de silinir (yumuşak silme yalnızca kayıt için; şifreli veri boşaltılır)
  const r = await db.update(schema.mediaBlobs).set({ deletedAt: new Date(), data: Buffer.alloc(0) }).where(and(eq(schema.mediaBlobs.id, id), eq(schema.mediaBlobs.userId, userId), isNull(schema.mediaBlobs.deletedAt))).returning({ id: schema.mediaBlobs.id })
  return r.length > 0
}
