import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { canEnter } from '@/lib/access'
import { logoutAction } from '@/app/(auth)/actions'
import { btn } from '@/components/ui'
import { Clock, Lock, Logout } from '@/components/icons'

export const metadata: Metadata = { title: 'Onay bekleniyor · DgFit' }
export const dynamic = 'force-dynamic'

const TEXT = {
  pending: { title: 'Hesabın onay bekliyor', body: 'Kaydın alındı. DgFit şu an davetle açılıyor; yönetici hesabını onayladığında bu sayfayı yenileyerek devam edebilirsin. Bilgilerin güvende, bir şey yapmana gerek yok.' },
  rejected: { title: 'Kaydın onaylanmadı', body: 'Bu hesap için erişim verilmedi. Bir yanlışlık olduğunu düşünüyorsan seni davet eden kişiyle iletişime geç.' },
  suspended: { title: 'Hesabın askıya alındı', body: 'Bu hesabın erişimi geçici olarak durduruldu. Verilerin silinmedi. Ayrıntı için yöneticiyle iletişime geç.' },
} as const

export default async function Page() {
  const u = await getSessionUser()
  if (!u) redirect('/giris')
  if (canEnter(u.status, u.admin)) redirect(u.onboarded ? '/' : '/kurulum')
  const t = TEXT[(u.status as keyof typeof TEXT)] ?? TEXT.pending
  const pending = u.status === 'pending'
  return (
    <main className="min-h-dvh max-w-md mx-auto px-5 safe-top pb-10 flex flex-col" data-testid="waiting" data-status={u.status}>
      <div className="pt-6 pb-10 flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-xl bg-acc text-acc-ink flex items-center justify-center num font-bold text-[15px]">Dg</span>
        <span className="num font-bold text-[18px] tracking-wide text-acc">DgFit</span>
      </div>
      <div className="flex flex-col items-center text-center gap-4 mt-6">
        <span className={`w-20 h-20 rounded-full flex items-center justify-center ${pending ? 'bg-acc/15 text-acc' : 'bg-danger/15 text-danger'}`}>
          {pending ? <Clock size={38} /> : <Lock size={36} />}
        </span>
        <h1 className="text-[26px] font-extrabold leading-tight">{t.title}</h1>
        <p className="text-[15px] text-ink-2 leading-relaxed">{t.body}</p>
        <div className="card w-full px-4 py-3 flex justify-between text-[14px] mt-2">
          <span className="text-mute">Hesap</span><b className="truncate">@{u.username}</b>
        </div>
      </div>
      <div className="mt-auto pt-10 flex flex-col gap-3">
        {pending ? <Link href="/beklemede" prefetch={false} className={btn.primary}>Durumu yenile</Link> : null}
        <form action={logoutAction}><button type="submit" className={btn.secondary + ' w-full h-12'}><Logout size={18} /> Çıkış yap</button></form>
      </div>
    </main>
  )
}
