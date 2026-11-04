'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { btn } from '@/components/ui'
import { uploadPhoto } from '../../olcumler/MeasureClient'

/** Kullanıcının kendi hareketine fotoğraf (şifreli, yalnızca sahibine görünür). */
export default function ExercisePhoto({ exerciseId, has }: { exerciseId: number; has: boolean }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()
  return (
    <div className="flex flex-col gap-1">
      <label className={`${btn.secondary} cursor-pointer ${busy ? 'opacity-50' : ''}`}>
        {busy ? 'Yükleniyor…' : has ? 'Fotoğrafı değiştir' : 'Fotoğraf ekle'}
        <input type="file" accept="image/*" className="sr-only" data-testid="exercise-photo-input" disabled={busy} onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = ''
          if (!f) return
          setBusy(true); setErr(null)
          try { const r = await uploadPhoto(f, { kind: 'exercise', exerciseId: String(exerciseId) }); if (r.error) setErr(r.error); else router.refresh() }
          catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
        }} />
      </label>
      {err ? <p role="alert" className="text-[13px] text-danger">{err}</p> : null}
    </div>
  )
}
