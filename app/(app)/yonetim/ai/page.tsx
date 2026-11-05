import { requireAdmin } from '@/lib/admin'
import { providerOverview } from '@/lib/ai/engine'
import { Eyebrow, TopBar } from '@/components/ui'
import { fmtNum } from '@/lib/calc'
import { ProviderForm, UserDailyForm } from './AiAdmin'

export const metadata = { title: 'AI ayarları · DgFit' }
const t = (d: Date | null) => (d ? new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d) : '—')

export default async function AiAdminPage() {
  await requireAdmin()
  const o = await providerOverview()
  const sum = (f: (x: (typeof o.today)[number]) => boolean) => o.today.filter(f).reduce((a, x) => a + x.n, 0)
  return (
    <div className="flex flex-col gap-3 px-4 pt-5">
      <TopBar back="/profil" title="AI ayarları" />
      <section className="card p-5 flex flex-col gap-2" data-testid="ai-today">
        <Eyebrow>Bugün</Eyebrow>
        <p className="text-[14px] text-ink-2"><b className="num">{sum((x) => x.ok && !x.cached)}</b> başarılı çağrı · <b className="num">{sum((x) => x.cached)}</b> önbellekten · <b className="num">{sum((x) => !x.ok)}</b> hata</p>
        <p className="text-[12px] text-mute">Sağlayıcılar küçük sıra numarasından başlayarak denenir; kota, limit ya da hata olursa sıradakine geçilir. Anahtarlar sunucuda şifreli saklanır ve burada yalnızca son 4 karakteri görünür.</p>
      </section>
      {o.providers.map((p) => (
        <section key={p.id} className="card p-5 flex flex-col gap-3" aria-label={p.label} data-testid={`provider-${p.id}`}>
          <div className="flex justify-between items-center">
            <span className="font-extrabold">{p.label}</span>
            <span className={`text-[12px] font-bold ${p.skipped ? 'text-orange' : 'text-lime'}`} data-testid="provider-status">{p.skipped ?? 'Kullanılabilir'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[12px] text-mute">
            <span>Anahtar: <b className="text-ink num">{p.keyLast4 ? `••••${p.keyLast4}` : 'yok'}</b></span>
            <span>Bugün: <b className="text-ink num">{fmtNum(p.usedToday)}</b> token</span>
            <span>Bu ay: <b className="text-ink num">{fmtNum(p.usedMonth)}</b> token</span>
            <span>Bekleme: <b className="text-ink">{p.cooldownUntil && p.cooldownUntil > new Date() ? t(p.cooldownUntil) : '—'}</b></span>
          </div>
          {p.lastError ? <p className="text-[12px] text-danger" data-testid="provider-error">Son hata ({t(p.lastErrorAt)}): {p.lastError}</p> : null}
          <ProviderForm p={{ id: p.id, enabled: p.enabled, priority: p.priority, model: p.model, dailyTokenLimit: p.dailyTokenLimit, monthlyTokenLimit: p.monthlyTokenLimit, hasKey: !!p.keyLast4, cooling: !!(p.cooldownUntil && p.cooldownUntil > new Date()) || !!p.lastError }} />
        </section>
      ))}
      <UserDailyForm value={o.settings.userDaily} />
    </div>
  )
}
