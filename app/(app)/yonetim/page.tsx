import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin'
import { barcodeMissList, dashboard } from '@/lib/admin-data'
import { providerOverview } from '@/lib/ai/engine'
import { FEEDBACK_KINDS, type FeedbackKind } from '@/lib/access'
import { longDate, dayString } from '@/lib/time'
import { Band } from '@/components/ui'
import { Chat, Clock, Search, Shield, Spark, Ticket, Users } from '@/components/icons'
import ActivityBars from './ActivityBars'
import { AdminCard, Avatar, PreviewRow, ago } from './ui'

export const metadata: Metadata = { title: 'Yönetim · DgFit' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireAdmin()
  const [d, ai, misses] = await Promise.all([dashboard(), providerOverview(), barcodeMissList()])
  const mod = d.moderation.posts + d.moderation.comments + d.moderation.reports + d.moderation.proofs
  const usable = ai.providers.filter((p) => !p.skipped)
  const tile = (label: string, value: number, sub: string, hot = false) => (
    <div className={`rounded-2xl px-3 py-2.5 flex flex-col min-w-0 ${hot ? 'bg-white text-[#14161B]' : 'bg-[var(--band-box)]'}`}>
      <span className="text-[11.5px] font-semibold opacity-90 leading-tight break-words">{label}</span>
      <b className="num text-[24px] font-bold leading-tight">{value}</b>
      <span className="text-[11px] font-semibold opacity-80 leading-tight break-words">{sub}</span>
    </div>
  )
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="admin-home">
      <Band title="Yönetim" sub={`${longDate(dayString())} · ${d.users.activeToday} kişi bugün aktif`}>
        <div className="grid grid-cols-3 gap-2 mt-4" data-testid="admin-stats">
          {tile('Kullanıcı', d.users.total, `+${d.users.newWeek} bu hafta`)}
          {tile('Aktif', d.users.activeWeek, 'son 7 gün')}
          {tile('Onay bekleyen', d.users.pending, d.users.pending ? 'işlem bekliyor' : 'temiz', d.users.pending > 0)}
          {tile('Geri bildirim', d.feedback.fresh, `${d.feedback.open} açık`, d.feedback.fresh > 0)}
          {tile('AI çağrısı', d.ai.ok, d.ai.err ? `${d.ai.err} hata · bugün` : 'bugün')}
          {tile('Moderasyon', mod, mod ? 'bekliyor' : 'temiz', mod > 0)}
        </div>
        <ActivityBars days={d.days} />
      </Band>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 relative">
        <AdminCard href="/yonetim/kullanicilar?durum=pending" testId="card-pending" icon={<Clock size={22} />} title="Kayıt onayları" value={d.users.pending} unit="bekleyen" alert={d.users.pending > 0}
          hint={d.users.pending ? 'Onaylanana kadar uygulamaya giremezler' : 'Bekleyen kayıt yok'}>
          {d.pending.length ? d.pending.map((p) => <PreviewRow key={p.id} left={<b>@{p.username}</b>} right={ago(p.createdAt)} />) : null}
        </AdminCard>
        <AdminCard href="/yonetim/kullanicilar" testId="card-users" icon={<Users size={22} />} title="Kullanıcılar" value={d.users.total} unit="toplam"
          hint={`${d.users.approved} onaylı${d.users.blocked ? ` · ${d.users.blocked} engelli` : ''} · bugün ${d.users.activeToday} aktif`}>
          {d.recent.length ? <div className="flex -space-x-2">{d.recent.map((r) => <span key={r.id} className="ring-2 ring-surface rounded-full"><Avatar name={r.username} size={30} /></span>)}</div> : null}
        </AdminCard>
        <AdminCard href="/yonetim/geri-bildirim" testId="card-feedback" icon={<Chat size={22} />} title="Geri bildirimler" value={d.feedback.fresh} unit="yeni" alert={d.feedback.fresh > 0}
          hint={`${d.feedback.open} açık · toplam ${d.feedback.total}`}>
          {d.feedback.last.map((f) => <PreviewRow key={f.id} left={<><b>{FEEDBACK_KINDS[f.kind as FeedbackKind]?.label ?? f.kind}</b> · {f.body}</>} right={ago(f.createdAt)} />)}
        </AdminCard>
        <AdminCard href="/yonetim/moderasyon" testId="card-moderation" icon={<Shield size={22} />} title="Moderasyon" value={mod} unit="bekleyen" alert={mod > 0}
          hint={`${d.moderation.posts} gönderi · ${d.moderation.comments} yorum · ${d.moderation.reports} şikayet · ${d.moderation.proofs} rekor kanıtı`} />
        <AdminCard href="/yonetim/ai" testId="card-ai" icon={<Spark size={22} />} title="AI sağlayıcıları" value={usable.length} unit={`/ ${ai.providers.length} hazır`}
          hint={`Bugün ${d.ai.ok} çağrı · ${d.ai.cached} önbellek · ${d.ai.err} hata`}>
          {ai.providers.map((p) => <PreviewRow key={p.id} left={<b>{p.label}</b>} right={<span className={p.skipped ? 'text-orange' : 'text-good'}>{p.skipped ?? 'Kullanılabilir'}</span>} />)}
        </AdminCard>
        <AdminCard href="/yonetim/davetler" testId="card-invites" icon={<Ticket size={22} />} title="Davet kodları" value={d.invites.active} unit="etkin"
          hint="Kodla kayıt olan onay beklemeden girer" />
        <AdminCard href="/yonetim/tasarim" testId="card-design" icon={<Spark size={22} />} title="Tasarım" hint="Yarışma teması, duyuru kartı, varsayılan düzen" />
        <AdminCard href="/yonetim/barkodlar" testId="card-barcodes" icon={<Search size={22} />} title="Bulunamayan barkodlar" value={misses.length} unit="ürün"
          hint="Okutulup hiçbir veritabanında bulunamayan ürünler">
          {misses.slice(0, 3).map((m) => <PreviewRow key={m.code} left={<b className="num">{m.code}</b>} right={`${m.count} kez · ${ago(m.lastAt)}`} />)}
        </AdminCard>
      </div>
      <p className="text-[12px] text-mute text-center px-4 pb-2">Yöneticiler sunucu ayarından gelir (DGFIT_ADMINS) ve onay gerektirmez.</p>
    </div>
  )
}
