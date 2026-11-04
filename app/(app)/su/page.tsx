import ModuleSoon from '@/components/ModuleSoon'
import { Drop } from '@/components/icons'
export const metadata = { title: 'Su' }
export default function Page() {
  return <ModuleSoon title="Su" icon={<Drop size={22} />} color="var(--color-water)" phase="Sıradaki modül"
    lead="Su modülü geliştirme sırasında ilk sırada. Tek dokunuşla kayıt, kendi şişelerin ve davranışını öğrenen hatırlatmalar geliyor."
    features={['Tek dokunuşla 50–500 ml ve özelleştirilebilir miktarlar', 'Yudum kaydı ve kişisel yudum kalibrasyonu', 'Bardak, termos ve şişe tanımlama; doluluk seçerek ekleme', 'Sesli kayıt: “Az önce 300 ml su içtim”', 'Davranışını öğrenen akıllı hatırlatmalar', 'Saatlik, haftalık, aylık ve yıllık istatistikler', 'Tahmin: gün sonu toplamı ve hedefe ulaşma saati']} />
}
