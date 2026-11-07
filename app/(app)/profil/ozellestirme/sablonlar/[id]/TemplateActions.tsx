'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Sheet from '@/components/Sheet'
import { templateAction } from '../../actions'

const MODES: ['all' | 'colors' | 'layout', string, string][] = [
  ['all', 'Tümünü kullan', 'Düzen, renkler ve stil'],
  ['colors', 'Yalnız renkler', 'Modül ve kart renkleri, köşe, yazı tipi; düzenin aynı kalır'],
  ['layout', 'Yalnız düzen', 'Kartların sırası, alt bar, kurallar; renklerin aynı kalır'],
]

export default function TemplateActions({ id, name, liked, saved, mine, admin, status }: { id: string; name: string; liked: boolean; saved: boolean; mine: boolean; admin: boolean; status: string }) {
  const [msg, setMsg] = useState<string | null>(null)
  const [use, setUse] = useState(false)
  const [lk, setLk] = useState(liked), [sv, setSv] = useState(saved)
  const [pending, start] = useTransition()
  const router = useRouter()
  const run = (input: Record<string, unknown>, done: string, after?: (r: { id?: string }) => void) => start(async () => {
    const r = await templateAction({ id, ...input }).catch(() => null)
    setMsg(r?.ok ? done : r && !r.ok ? r.error : 'Olmadı')
    if (r?.ok) { after?.(r); router.refresh() }
  })
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={pending} aria-pressed={lk} onClick={() => { setLk(!lk); run({ op: 'like', on: !lk }, lk ? 'Beğeni kaldırıldı' : 'Beğendin') }} data-testid="tpl-like"
          className="h-12 rounded-full border border-line-2 font-bold text-[14px] aria-pressed:bg-acc aria-pressed:text-acc-ink aria-pressed:border-acc">{lk ? '♥ Beğendin' : '♡ Beğen'}</button>
        <button type="button" disabled={pending} aria-pressed={sv} onClick={() => { setSv(!sv); run({ op: 'save', on: !sv }, sv ? 'Kayıttan çıkarıldı' : 'Kaydedildi') }} data-testid="tpl-save"
          className="h-12 rounded-full border border-line-2 font-bold text-[14px] aria-pressed:bg-surface-3">{sv ? '✓ Kaydedildi' : 'Kaydet'}</button>
      </div>
      <button type="button" onClick={() => setUse(true)} className="h-14 rounded-full bg-acc text-acc-ink font-extrabold text-[16px]" data-testid="tpl-use">Bu şablonu kullan</button>
      <button type="button" disabled={pending} onClick={() => run({ op: 'remix' }, 'Tasarımlarına eklendi; düzenleyip kendi şablonun olarak paylaşabilirsin', () => router.push('/profil/ozellestirme/tasarimlar'))}
        className="h-12 rounded-full border border-line-2 font-bold text-[14px]" data-testid="tpl-remix">↻ Tasarımlarıma ekle (remix)</button>
      {msg ? <p role="status" className="text-[13px] font-bold text-ink-2 px-1">{msg}</p> : null}
      <div className="flex flex-wrap gap-2 justify-center pt-1">
        {!mine ? <button type="button" disabled={pending} onClick={() => { const reason = prompt('Neden şikayet ediyorsun? (ör. uygunsuz ad)'); if (reason?.trim()) run({ op: 'report', reason: reason.trim() }, 'Şikayetin alındı') }} className="h-9 px-3 text-[12.5px] font-bold text-mute" data-testid="tpl-report">Şikayet et</button> : null}
        {mine || admin ? <button type="button" disabled={pending} onClick={() => { if (confirm(`${name} şablonu silinsin mi?`)) run({ op: 'delete' }, 'Silindi', () => router.push('/profil/ozellestirme/sablonlar')) }} className="h-9 px-3 text-[12.5px] font-bold text-danger" data-testid="tpl-delete">Şablonu sil</button> : null}
        {admin ? <>
          <button type="button" disabled={pending} onClick={() => run({ op: 'admin', action: 'feature' }, 'Haftanın şablonu yapıldı')} className="h-9 px-3 text-[12.5px] font-bold text-acc" data-testid="tpl-feature">Haftanın şablonu yap</button>
          {status !== 'public' ? <button type="button" disabled={pending} onClick={() => run({ op: 'admin', action: 'approve' }, 'Onaylandı')} className="h-9 px-3 text-[12.5px] font-bold text-acc">Onayla</button> : <button type="button" disabled={pending} onClick={() => run({ op: 'admin', action: 'hide' }, 'Gizlendi')} className="h-9 px-3 text-[12.5px] font-bold text-mute">Gizle</button>}
        </> : null}
      </div>
      <Sheet open={use} onClose={() => setUse(false)} title={`${name} · kullan`}>
        <div className="flex flex-col gap-2 pb-4" data-testid="use-sheet">
          {MODES.map(([m, l, h]) => (
            <button key={m} type="button" disabled={pending} onClick={() => { setUse(false); run({ op: 'use', mode: m }, 'Şablon uygulandı', () => router.push('/')) }} data-use-mode={m}
              className="min-h-[60px] px-4 rounded-[18px] bg-surface-2 text-left flex flex-col justify-center"><b className="text-[15px]">{l}</b><span className="text-[12.5px] text-mute">{h}</span></button>
          ))}
          <p className="text-[12px] text-mute leading-snug pt-1">Eski hâline Tasarımlarım → sürümlerden dönebilirsin. Birimlerin ve kişisel ayarların değişmez.</p>
        </div>
      </Sheet>
    </>
  )
}
