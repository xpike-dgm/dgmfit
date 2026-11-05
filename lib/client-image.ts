'use client'
/** Fotoğrafı tarayıcıda küçült (uzun kenar en çok `max` px, JPEG) — EXIF/konum bilgisi de böylece düşer. */
export async function shrinkImage(file: Blob, max = 1280, quality = 0.85): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(bmp.width * s)); c.height = Math.max(1, Math.round(bmp.height * s))
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Fotoğraf işlenemedi'))), 'image/jpeg', quality))
}
