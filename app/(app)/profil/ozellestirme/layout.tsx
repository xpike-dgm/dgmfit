// G1: özelleştirme bölümü stüdyonun vurgu rengini (Bugün yeşili) kullanır; profil modülünün gri vurgusu anahtarları ve
// seçili düğmeleri soluk gösteriyordu. Kendi rengi olan öğeler (data-mod) bunu ezer.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div data-mod="today">{children}</div>
}
