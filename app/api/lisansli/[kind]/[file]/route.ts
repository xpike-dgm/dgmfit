import fs from 'node:fs'
import { Readable } from 'node:stream'
import { getUser } from '@/lib/auth'
import { licensedPath } from '@/lib/licensed'

const TYPES: Record<string, string> = { mp4: 'video/mp4', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', json: 'application/json' }

/** Lisanslı paket dosyası (video, anatomi, plaka): yalnızca onaylı kullanıcıya; videolarda Range (ileri sarma). */
export async function GET(req: Request, ctx: { params: Promise<{ kind: string; file: string }> }) {
  const u = await getUser()
  if (!u) return new Response(null, { status: 401 })
  const { kind, file } = await ctx.params
  let name: string
  try { name = decodeURIComponent(file) } catch { return new Response(null, { status: 404 }) } // bozuk % kodu → 404 (500 değil)
  const p = licensedPath(kind, name)
  if (!p) return new Response(null, { status: 404 })
  const size = fs.statSync(p).size
  const type = TYPES[p.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream'
  const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=604800', 'X-Content-Type-Options': 'nosniff' }
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '')
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]))
    let end = m[1] && m[2] ? Number(m[2]) : size - 1
    end = Math.min(end, size - 1); start = Math.max(0, start)
    if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    const body = Readable.toWeb(fs.createReadStream(p, { start, end })) as ReadableStream
    return new Response(body, { status: 206, headers: { ...base, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) } })
  }
  return new Response(Readable.toWeb(fs.createReadStream(p)) as ReadableStream, { headers: { ...base, 'Content-Length': String(size) } })
}
