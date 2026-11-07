import { requireUser } from '@/lib/auth'
import { userStyle } from '@/lib/cards/design-data'
import StudioHeader from '@/components/cards/StudioHeader'
import StyleForm from '../StyleForm'

export const metadata = { title: 'Daha fazla stil' }

/** Ö2b/Ö6: simgeler, bant, erişilebilirlik, birimler, titreşim/ses, akşam renkleri, diğer yazı tipleri. */
export default async function Page() {
  const u = await requireUser()
  return (
    <div className="px-4 flex flex-col gap-3 pb-6">
      <StudioHeader back="/profil/ozellestirme/stil" title="Daha fazla" />
      <StyleForm initial={await userStyle(u.id)} more />
    </div>
  )
}
