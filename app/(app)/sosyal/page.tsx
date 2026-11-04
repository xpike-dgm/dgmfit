import ModuleSoon from '@/components/ModuleSoon'
import { Users } from '@/components/icons'
export const metadata = { title: 'Sosyal' }
export default function Page() {
  return <ModuleSoon title="Sosyal" icon={<Users size={22} />} color="var(--color-violet)" phase="Faz 5"
    lead="Arkadaşlarınla motivasyonunu paylaş; PR'larını göster, antrenmanlarını kopyala, meydan okumalara katıl."
    features={['Arkadaş ekleme ve takip', 'Gönderi, antrenman ve tarif paylaşımı', 'PR vitrini', 'Meydan okumalar ve gruplar', 'Öğe bazında gizlilik ayarları']} />
}
