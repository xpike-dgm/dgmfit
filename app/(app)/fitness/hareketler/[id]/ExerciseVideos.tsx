'use client'
import { useState } from 'react'

/** Doğru / yanlış yapılış videosu (lisanslı içerik). Sessiz, döngülü, satır içi oynar. */
export default function ExerciseVideos({ right, wrong, name }: { right: string | null; wrong: string | null; name: string }) {
  const [tab, setTab] = useState<'right' | 'wrong'>(right ? 'right' : 'wrong')
  const src = tab === 'right' ? right : wrong
  return (
    <div className="flex flex-col gap-2" data-testid="ex-videos">
      {right && wrong ? (
        <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-surface-2" role="tablist" aria-label="Video">
          {([['right', 'Doğru yapılış'], ['wrong', 'Yanlış yapılış']] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`h-9 rounded-full text-[13px] font-bold transition ${tab === k ? (k === 'right' ? 'bg-good text-white' : 'bg-danger text-white') : 'text-ink-2'}`}>{l}</button>
          ))}
        </div>
      ) : null}
      {src ? (
        <video key={src} src={src} className="w-full aspect-square object-cover rounded-2xl bg-surface-2" autoPlay muted loop playsInline controls preload="metadata"
          aria-label={`${name} · ${tab === 'right' ? 'doğru' : 'yanlış'} yapılış`} data-testid="ex-video" />
      ) : null}
    </div>
  )
}
