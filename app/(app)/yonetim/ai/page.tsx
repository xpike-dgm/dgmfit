import { requireAdmin } from '@/lib/admin'
import { providerOverview } from '@/lib/ai/engine'
import { Eyebrow, TopBar } from '@/components/ui'
import { fmtNum } from '@/lib/calc'
import { ProviderForm, UserDailyForm } from './AiAdmin'

export const metadata = { title: 'AI ayarları · DgFit' }
const TASK_LABEL: Record<string, string> = { 'meal-photo': 'öğün fotoğrafı', label: 'etiket', 'meal-text': 'yazı / ses', coach: 'koç sohbeti', insight: 'günlük içgörü', weekly: 'haftalık rapor', menu: 'menü', pantry: 'elimdekiler', restaurant: 'restoran menüsü', program: 'program' }
const t = (d: Date | null) => (d ? new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d) : '—')

export default async function AiAdminPage() {
  await requireAdmin()
  const o = await providerOverview()
  const sum = (f: (x: (typeof o.today)[number]) => boolean) => o.today.filter(f).reduce((a, x) => a + x.n, 0)
  return (
    <div className="flex flex-col gap-3 px-4">
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
            <span className={`text-[12px] font-bold ${p.skipped ? 'text-orange' : 'text-acc'}`} data-testid="provider-status">{p.skipped ?? 'Kullanılabilir'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[12px] text-mute">
            <span>Anahtar: <b className="text-ink num">{p.keyLast4 ? `••••${p.keyLast4}` : 'yok'}</b></span>
            <span>Bugün: <b className="text-ink num">{fmtNum(p.usedToday)}</b> token</span>
            <span>Bu ay: <b className="text-ink num">{fmtNum(p.usedMonth)}</b> token</span>
            <span>Bekleme: <b className="text-ink">{p.cooldownUntil && p.cooldownUntil > new Date() ? t(p.cooldownUntil) : '—'}</b></span>
          </div>
          {p.lastError ? <p className="text-[12px] text-danger" data-testid="provider-error">Son hata ({t(p.lastErrorAt)}): {p.lastError}</p> : null}
          <ProviderForm p={{ id: p.id, enabled: p.enabled, priority: p.priority, model: p.model, taskModels: p.taskModels, dailyTokenLimit: p.dailyTokenLimit, monthlyTokenLimit: p.monthlyTokenLimit, hasKey: !!p.keyLast4, cooling: !!(p.cooldownUntil && p.cooldownUntil > new Date()) || !!p.lastError }} />
        </section>
      ))}
      <section className="card p-5 flex flex-col gap-2" aria-label="Maliyet" data-testid="ai-cost">
        <Eyebrow>Bu ay · tahmini maliyet</Eyebrow>
        {o.cost.length ? (
          <div className="overflow-x-auto -mx-1 px-1"><table className="w-full text-[12px] num">
            <thead><tr className="text-mute text-left"><th className="py-1 font-semibold">Model · görev</th><th className="font-semibold text-right">Çağrı</th><th className="font-semibold text-right">Token (gir/çık)</th><th className="font-semibold text-right">Çağrı başı</th><th className="font-semibold text-right">Toplam</th></tr></thead>
            <tbody>{o.cost.map((c) => (
              <tr key={c.model + c.task} className="border-t border-line">
                <td className="py-1.5">{c.model}<br /><span className="text-mute">{TASK_LABEL[c.task] ?? c.task}</span></td>
                <td className="text-right">{c.n}</td>
                <td className="text-right">{fmtNum(Math.round(c.inputTokens / c.n))} / {fmtNum(Math.round(c.outputTokens / c.n))}</td>
                <td className="text-right">{c.perCall === null ? '?' : '$' + c.perCall.toFixed(4)}</td>
                <td className="text-right">{c.usd === null ? '?' : '$' + c.usd.toFixed(3)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="text-[13px] text-mute">Bu ay henüz başarılı çağrı yok.</p>}
        <p className="text-[11px] text-mute">Gerçek token sayıları × liste fiyatı (milyon token başına; Opus 5.5 $4/$20, Haiku 5.5 $0,10/$0,50, gpt-6-luna $0,10/$0,50). Faturadaki tutar için sağlayıcı paneline bak; önbellekten gelenler ücretsizdir.</p>
      </section>
      <UserDailyForm value={o.settings.userDaily} />
    </div>
  )
}
