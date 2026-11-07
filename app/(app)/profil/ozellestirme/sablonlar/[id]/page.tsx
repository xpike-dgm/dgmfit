import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getTemplate } from '@/lib/cards/templates-data'
import { CATEGORIES } from '@/lib/cards/templates'
import { MODULES, modulePalette } from '@/lib/cards/colors'
import { SCREENS, type ScreenId } from '@/lib/cards/registry'
import StudioHeader from '@/components/cards/StudioHeader'
import MiniPreview from '@/components/cards/MiniPreview'
import TemplateActions from './TemplateActions'
import QRCode from 'qrcode'
import { headers } from 'next/headers'
import { ownedGroups } from '@/lib/cards/community-data'
import { publicTemplateUrl } from '@/lib/cards/community'
import CommunityButton from '../../CommunityButton'
import ShareLink from './ShareLink'

export const metadata = { title: 'Şablon' }

/** Ö3b: şablon ayrıntısı — her ekranın önizlemesi, renkler, kurallar; kullan (tümü / renkler / düzen), remix, beğen/kaydet. */
export default async function Page(props: { params: Promise<{ id: string }> }) {
  const u = await requireUser()
  const t = await getTemplate(u.id, (await props.params).id, u.admin)
  if (!t) notFound()
  const screens = (Object.keys(SCREENS) as ScreenId[]).filter((s) => s === 'today' || t.data.screens?.[s])
  const h = await headers()
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host') ?? 'dgfit.dgmcraft.online'}`
  const link = publicTemplateUrl(origin, t.id)
  const qr = t.status === 'public' ? await QRCode.toString(link, { type: 'svg', margin: 1, width: 168, color: { dark: '#11130F', light: '#FFFFFF' } }) : null
  const groups = t.status === 'public' ? await ownedGroups(u.id) : []
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="template-detail">
      <StudioHeader back="/profil/ozellestirme/sablonlar" title={t.name} />
      <p className="text-[12.5px] text-mute -mt-2 px-1">{`@${t.owner} · ${CATEGORIES.find((c) => c.id === t.category)?.label ?? 'Diğer'}`}</p>
      <section aria-label="Önizleme" className="card p-3 flex gap-3 overflow-x-auto">
        {screens.map((s) => <figure key={s} className="flex flex-col items-center gap-1 shrink-0"><MiniPreview design={t.data} screen={s} width={92} label={`${SCREENS[s].title} önizlemesi`} /><figcaption className="text-[11.5px] font-bold text-mute">{SCREENS[s].title}</figcaption></figure>)}
      </section>
      <section className="card p-4 flex flex-col gap-2">
        {t.featured ? <span className="self-start text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-acc text-acc-ink">HAFTANIN ŞABLONU</span> : null}
        {t.status !== 'public' ? <span className="self-start text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-surface-3 text-ink-2" data-testid="template-status">{t.status === 'pending' ? 'ONAY BEKLİYOR' : 'GİZLİ'}</span> : null}
        {t.description ? <p className="text-[14px] leading-relaxed">{t.description}</p> : null}
        {t.tags.length ? <p className="text-[12.5px] text-acc font-bold">{t.tags.map((x) => '#' + x).join(' ')}</p> : null}
        {t.remixOf ? <p className="text-[12.5px] text-mute">↻ <Link href={`/profil/ozellestirme/sablonlar/${t.remixOf.id}`} className="underline">{t.remixOf.name}</Link> (@{t.remixOf.owner}) şablonundan</p> : null}
        <div className="flex gap-1 pt-1" aria-label="Modül renkleri">
          {MODULES.map((m) => { const c = t.data.modules?.[m.id]; return <span key={m.id} title={m.label} className="flex-1 h-6 first:rounded-l-lg last:rounded-r-lg" style={{ background: modulePalette(c ?? m.base).m1, opacity: c ? 1 : 0.35 }} /> })}
        </div>
        <p className="text-[12px] text-mute num">♥ {t.likes} · {t.saves} kayıt · {t.uses} kullanım · {(t.data.rules ?? []).length} kural · <Link href={`/profil/ozellestirme/tasarimci/${t.owner}`} className="underline" data-testid="tpl-designer">@{t.owner}</Link></p>
        <p className="text-[11.5px] text-mute">Şablonlar kişisel veri içermez: kilo, kalori, birim, tek el ayarı ve fotoğraflar paylaşılmaz.</p>
      </section>
      <TemplateActions id={t.id} name={t.name} liked={t.liked} saved={t.saved} mine={t.ownerId === u.id} admin={u.admin} status={t.status} />
      {qr ? <ShareLink link={link} qr={qr} name={t.name} /> : null}
      {groups.length ? (
        <section aria-label="Grup teması" className="card p-4 flex flex-col gap-2" data-testid="group-theme">
          <b className="text-[15px]">Grup teması yap</b>
          <span className="text-[12.5px] text-mute">Grubunun üyeleri bu şablonu grup sayfasında görür ve tek dokunuşla kullanabilir.</span>
          {groups.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-2 min-h-11" data-group={g.name}>
              <span className="text-[14px] font-bold truncate">{g.name}</span>
              {g.theme === t.id ? <CommunityButton input={{ op: 'groupTheme', groupId: g.id, templateId: null }} label="Temayı kaldır" done="Grup teması kaldırıldı" className="h-9 px-3 rounded-full border border-line-2 text-[12.5px] font-bold" />
                : <CommunityButton input={{ op: 'groupTheme', groupId: g.id, templateId: t.id }} label="Tema yap" done="Grup teması ayarlandı" testId="set-group-theme" />}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  )
}
