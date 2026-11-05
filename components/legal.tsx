// Yasal metinler: hem /yasal sayfalarında hem kayıt ekranındaki alt sayfada aynı içerik (kayıt formu kaybolmasın diye sayfa değiştirmeden açılır).

export const legalProse = 'flex flex-col gap-4 text-[15px] leading-relaxed text-ink-2 [&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:text-ink [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink'

export function TermsText() {
  return (
    <>
      <h1>Kullanım koşulları</h1>
      <p><b>Taslak metin</b> — yayın öncesi hukukçu kontrolünden geçirilecektir.</p>
      <h2>Hizmet</h2>
      <p>DgFit; antrenman, beslenme, su ve kilo takibi sunan ücretsiz bir uygulamadır. Uygulamadaki öneriler genel bilgilendirme amaçlıdır ve tıbbi tavsiye yerine geçmez.</p>
      <h2>Sağlık uyarısı</h2>
      <p>Hamilelik, emzirme, kronik hastalık veya 18 yaş altı durumlarında beslenme ve antrenman değişikliklerinden önce doktoruna danış.</p>
      <h2>Hesap</h2>
      <p>Hesap bilgilerinin gizliliğinden sen sorumlusun. Hesabını istediğin zaman silebilirsin; silme talebinden sonra verilerin 30 gün içinde kalıcı olarak silinir.</p>
    </>
  )
}

export function KvkkText() {
  return (
    <>
      <h1>KVKK aydınlatma metni</h1>
      <p><b>Taslak metin</b> — yayın öncesi hukukçu kontrolünden geçirilecektir.</p>
      <h2>İşlenen veriler</h2>
      <p>Kimlik ve iletişim (kullanıcı adı, e-posta), sağlık ile ilgili veriler (kilo, boy, yaş, cinsiyet, aktivite, beslenme, antrenman ve su kayıtları).</p>
      <h2>Amaç</h2>
      <p>Kişiye özel kalori, makro, su ve antrenman hedeflerinin hesaplanması ve uygulama özelliklerinin sunulması. Verilerin reklam amacıyla üçüncü kişilere aktarılmaz ve yapay zekâ modellerinin eğitiminde kullanılmaz.</p>
      <h2>Haklarınız</h2>
      <p>KVKK 11. madde kapsamındaki haklarını (bilgi talep etme, düzeltme, silme, itiraz) uygulama içinden veya iletişim adresimizden kullanabilirsin.</p>
    </>
  )
}
