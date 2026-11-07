'use client'
import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { btn } from '@/components/ui'
import { Check, Lock, Logout, Spark, Trash } from '@/components/icons'
import { deleteUserAction, endSessionsAction, resetDataAction, setAiDailyAction, setNoteAction, setStatusAction } from '../../actions'

type R = { ok: true; msg?: string } | { ok: false; error: string }
interface U { id: string; username: string; status: string; aiDaily: number | null; note: string; admin: boolean; self: boolean }
const field = 'w-full h-12 rounded-2xl bg-surface-2 border border-line px-4 text-[16px] outline-none focus:border-acc'

function Section({ title, icon, children, danger }: { title: string; icon: ReactNode; children: ReactNode; danger?: boolean }) {
  return (
    <section className={`card p-4 flex flex-col gap-3 ${danger ? 'border border-danger-line' : ''}`}>
      <h2 className={`flex items-center gap-2 text-[15px] font-extrabold ${danger ? 'text-danger' : ''}`}>{icon}{title}</h2>
      {children}
    </section>
  )
}

export default function Manage({ u, stats, defaultDaily }: { u: U; stats: { sessions: number; push: number; media: number; aiToday: number }; defaultDaily: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<Record<string, R>>({})
  const [daily, setDaily] = useState(u.aiDaily === null ? '' : String(u.aiDaily))
  const [note, setNote] = useState(u.note)
  const [resetConfirm, setResetConfirm] = useState('')
  const [social, setSocial] = useState(false)
  const [delConfirm, setDelConfirm] = useState('')
  const run = (key: string, f: () => Promise<R>, after?: (r: R) => void) => start(async () => { const r = await f(); setMsg((m) => ({ ...m, [key]: r })); after?.(r); router.refresh() })
  const Msg = ({ k }: { k: string }) => (msg[k] ? <p role="status" className={`text-[13px] font-semibold ${msg[k].ok ? 'text-good' : 'text-danger'}`}>{msg[k].ok ? (msg[k] as { msg?: string }).msg : (msg[k] as { error: string }).error}</p> : null)
  const effective = u.aiDaily ?? defaultDaily
  const canDestroy = !u.admin

  return (
    <>
      <Section title="Erişim" icon={<Check size={18} />}>
        <p className="text-[13px] text-mute">{u.status === 'pending' ? 'Bu kişi kayıt oldu ve onayını bekliyor.' : u.status === 'approved' ? 'Uygulamaya girebiliyor.' : 'Uygulamaya giremiyor; verileri duruyor.'}</p>
        <div className="grid grid-cols-2 gap-2">
          {u.status !== 'approved' ? <button type="button" disabled={pending} className={btn.primary + ' h-12 text-[15px] col-span-2'} onClick={() => run('st', () => setStatusAction(u.id, 'approved'))} data-testid="approve">Onayla</button> : null}
          {u.status === 'pending' ? <button type="button" disabled={pending || !canDestroy} className={btn.secondary} onClick={() => confirm(`@${u.username} reddedilsin mi?`) && run('st', () => setStatusAction(u.id, 'rejected'))}>Reddet</button> : null}
          {u.status !== 'suspended' && canDestroy ? <button type="button" disabled={pending} className={btn.secondary} data-testid="suspend" onClick={() => confirm(`@${u.username} askıya alınsın mı? Tüm oturumları kapanır.`) && run('st', () => setStatusAction(u.id, 'suspended'))}><Lock size={16} /> Askıya al</button> : null}
          {u.status === 'approved' && canDestroy ? <button type="button" disabled={pending} className={btn.secondary} onClick={() => run('st', () => setStatusAction(u.id, 'pending'))}>Beklemeye al</button> : null}
        </div>
        <Msg k="st" />
      </Section>

      <Section title="AI kotası" icon={<Spark size={18} />}>
        <p className="text-[13px] text-mute">Şu an <b className="text-ink num">{effective === 0 ? 'kapalı' : `günde ${effective}`}</b> {u.aiDaily === null ? `(genel ayar)` : '(bu kişiye özel)'} · bugün <b className="text-ink num">{stats.aiToday}</b> kullandı.</p>
        <div className="flex gap-2">
          <input id="user-ai-daily" className={field + ' num'} inputMode="numeric" placeholder={`Genel: ${defaultDaily}`} value={daily} onChange={(e) => setDaily(e.target.value.replace(/\D/g, '').slice(0, 4))} aria-label="Günlük AI hakkı" />
          <button type="button" disabled={pending} className={btn.secondary + ' h-12 shrink-0'} onClick={() => run('ai', () => setAiDailyAction(u.id, daily))}>Kaydet</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[0, 5, 20, 50, 100].map((n) => <button key={n} type="button" className="h-9 px-3 rounded-full border border-line-2 text-[12.5px] font-bold num" onClick={() => setDaily(String(n))}>{n === 0 ? 'Kapat (0)' : n}</button>)}
          <button type="button" className="h-9 px-3 rounded-full border border-line-2 text-[12.5px] font-bold" onClick={() => setDaily('')}>Genel ayar</button>
        </div>
        <Msg k="ai" />
      </Section>

      <Section title="Oturumlar ve cihazlar" icon={<Logout size={18} />}>
        <p className="text-[13px] text-mute"><b className="text-ink num">{stats.sessions}</b> açık oturum · <b className="text-ink num">{stats.push}</b> bildirim aboneliği · <b className="text-ink num">{stats.media}</b> şifreli fotoğraf</p>
        <button type="button" disabled={pending || u.self || !stats.sessions} className={btn.secondary} onClick={() => run('ses', () => endSessionsAction(u.id))}>Tüm oturumları kapat</button>
        <Msg k="ses" />
      </Section>

      <Section title="Yönetici notu" icon={<span className="text-[15px]">✎</span>}>
        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} rows={3} placeholder="Yalnızca yöneticiler görür" aria-label="Yönetici notu"
          className="w-full rounded-2xl bg-surface-2 border border-line px-4 py-3 text-[15px] outline-none focus:border-acc resize-none" />
        <button type="button" disabled={pending || note === u.note} className={btn.secondary} onClick={() => run('note', () => setNoteAction(u.id, note))}>Notu kaydet</button>
        <Msg k="note" />
      </Section>

      <Section title="Verileri sıfırla" icon={<Trash size={18} />} danger>
        <p className="text-[13px] text-ink-2 leading-relaxed">Profil, hedefler, tartı, öğün, su, antrenman, program, koç sohbetleri ve fotoğraflar silinir. Hesap ve şifre kalır; kişi bir sonraki girişte kurulumdan başlar. <b>Geri alınamaz.</b></p>
        <label className="flex items-center gap-2.5 text-[14px] font-semibold"><input type="checkbox" checked={social} onChange={(e) => setSocial(e.target.checked)} className="w-5 h-5" /> Sosyal verileri de sil (gönderi, arkadaşlık, grup, mesaj)</label>
        <input className={field} placeholder={`Onay için “${u.username}” yaz`} value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} aria-label="Sıfırlama onayı" autoCapitalize="none" />
        <button type="button" disabled={pending || resetConfirm.trim().toLowerCase() !== u.username.toLowerCase() || (u.admin && !u.self)} data-testid="reset-data"
          className="h-12 rounded-full bg-danger text-white font-extrabold text-[15px] disabled:opacity-40" onClick={() => run('reset', () => resetDataAction(u.id, resetConfirm, social), (r) => r.ok && setResetConfirm(''))}>Verileri sıfırla</button>
        <Msg k="reset" />
      </Section>

      {canDestroy ? (
        <Section title="Hesabı sil" icon={<Trash size={18} />} danger>
          <p className="text-[13px] text-ink-2 leading-relaxed">Hesap ve ona bağlı her şey kalıcı olarak silinir; kullanıcı adı yeniden alınabilir hâle gelir.</p>
          <input className={field} placeholder={`Onay için “${u.username}” yaz`} value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)} aria-label="Silme onayı" autoCapitalize="none" />
          <button type="button" disabled={pending || delConfirm.trim().toLowerCase() !== u.username.toLowerCase()} data-testid="delete-user"
            className="h-12 rounded-full border-2 border-danger text-danger font-extrabold text-[15px] disabled:opacity-40"
            onClick={() => run('del', () => deleteUserAction(u.id, delConfirm), (r) => { if (r.ok) router.replace('/yonetim/kullanicilar') })}>Hesabı kalıcı olarak sil</button>
          <Msg k="del" />
        </Section>
      ) : null}
    </>
  )
}
