'use client'
import { useState } from 'react'
import Link from 'next/link'
import CommunityButton from '../CommunityButton'

export default function EnterForm({ mine, current }: { mine: { id: string; name: string }[]; current: string | null }) {
  const [sel, setSel] = useState(current ?? mine[0]?.id ?? '')
  if (!mine.length) return <p className="text-[13px] text-mute">Katılmak için önce bir tasarımını <Link href="/profil/ozellestirme/tasarimlar" className="underline">şablon olarak paylaş</Link>.</p>
  return (
    <div className="flex gap-2 items-start flex-wrap" data-testid="contest-enter">
      <label className="sr-only" htmlFor="ce">Şablonun</label>
      <select id="ce" value={sel} onChange={(e) => setSel(e.target.value)} className="flex-1 min-w-0 h-10 rounded-xl bg-surface-2 border border-line px-2">{mine.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      <CommunityButton input={{ op: 'enter', templateId: sel }} label={current ? 'Katılımı değiştir' : 'Katıl'} done="Yarışmaya katıldın" testId="contest-join" />
    </div>
  )
}
