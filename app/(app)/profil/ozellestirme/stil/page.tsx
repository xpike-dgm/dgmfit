import { requireUser } from '@/lib/auth'
import { userStyle } from '@/lib/cards/design-data'
import { TopBar } from '@/components/ui'
import StyleForm from './StyleForm'

export const metadata = { title: 'Stil' }

/** Ö2b: stil — köşe, yoğunluk, yazı tipi, simgeler, bant, erişilebilirlik, birimler, dokunuş, akşam renkleri. */
export default async function Page() {
  const u = await requireUser()
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/profil/ozellestirme" title="Stil" sub="Görünüm, birimler, dokunuş" />
      <StyleForm initial={await userStyle(u.id)} />
    </div>
  )
}
