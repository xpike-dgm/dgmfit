import ModuleSoon from '@/components/ModuleSoon'
import { Dumbbell } from '@/components/icons'
export const metadata = { title: 'Fitness' }
export default function Page() {
  return <ModuleSoon title="Fitness" icon={<Dumbbell size={22} />} color="var(--color-orange)" phase="Faz 3"
    lead="Programını oluştur, salonda set set kaydet; AI bir sonraki antrenman için ağırlık önersin."
    features={['800+ hareket, kas haritası ve teknik açıklamaları', 'Program oluşturucu ve hazır şablonlar (PPL, Upper/Lower, 5/3/1…)', 'Kg, tekrar ve RIR ile set kaydı, dinlenme sayacı', 'e1RM tabanlı AI ağırlık önerisi', 'PR takibi, hacim ve kas grubu istatistikleri', 'Yakılan kalorinin Fit bütçesine otomatik eklenmesi']} />
}
