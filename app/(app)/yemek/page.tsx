import ModuleSoon from '@/components/ModuleSoon'
import { Fork } from '@/components/icons'
export const metadata = { title: 'Yemek' }
export default function Page() {
  return <ModuleSoon title="Yemek" icon={<Fork size={22} />} color="var(--color-lime)" phase="Faz 2"
    lead="Yediklerini en hızlı şekilde kaydet; kalori ve makrolar Bugün ekranındaki bütçene anında yansısın."
    features={['Türk mutfağı ağırlıklı besin veritabanı (TURKOMP, USDA, Open Food Facts)', 'Barkod okutma', 'Fotoğraftan yemek tanıma (AI)', 'Sesli ve yazılı kayıt: “2 dilim ekmekle mercimek çorbası”', 'Tarif oluşturma ve porsiyon hesabı', 'AI haftalık menü ve alışveriş listesi']} />
}
