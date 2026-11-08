// G1: uygulama içi onay penceresinin düğme adı ve rengi, iletiden çıkarılır ("silinsin mi?" → Sil, kırmızı).
export function inferOk(message: string): { ok: string; danger: boolean } {
  const m = message.toLocaleLowerCase('tr')
  if (/silin|silinecek/.test(m)) return { ok: 'Sil', danger: true }
  if (/engellenen/.test(m)) return { ok: 'Engelle', danger: true }
  if (/askıya/.test(m)) return { ok: 'Askıya al', danger: true }
  if (/reddedil/.test(m)) return { ok: 'Reddet', danger: true }
  if (/ayrılın/.test(m)) return { ok: 'Ayrıl', danger: true }
  if (/kapanacak/.test(m)) return { ok: 'Kapat', danger: true }
  if (/iptal/.test(m)) return { ok: 'İptal et', danger: true }
  if (/çıkarıl/.test(m)) return { ok: 'Çıkar', danger: true }
  if (/kaldırıl/.test(m)) return { ok: 'Kaldır', danger: true }
  if (/çıkılsın/.test(m)) return { ok: 'Çık', danger: true }
  if (/arşivlen/.test(m)) return { ok: 'Arşivle', danger: false }
  if (/dönsün/.test(m)) return { ok: 'Döndür', danger: false }
  return { ok: 'Tamam', danger: false }
}
