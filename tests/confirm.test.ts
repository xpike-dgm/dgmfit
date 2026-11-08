import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inferOk } from '../lib/confirm.ts'

test('onay düğmesi iletiden çıkarılır', () => {
  assert.deepEqual(inferOk('Program silinsin mi? Geçmiş antrenmanların korunur.'), { ok: 'Sil', danger: true })
  assert.deepEqual(inferOk('Bu ekran varsayılan düzene dönsün mü?'), { ok: 'Döndür', danger: false })
  assert.deepEqual(inferOk('Arkadaşlıktan çıkarılsın mı?'), { ok: 'Çıkar', danger: true })
  assert.deepEqual(inferOk('Engellenen kişi profilini göremez; arkadaşlık kaldırılır. Devam edilsin mi?'), { ok: 'Engelle', danger: true })
  assert.deepEqual(inferOk('Grup herkes için kapanacak. Emin misin?'), { ok: 'Kapat', danger: true })
  assert.deepEqual(inferOk('Değişiklikler kaydedilmeden çıkılsın mı?'), { ok: 'Çık', danger: true })
  assert.deepEqual(inferOk('Bir şey olsun mu?'), { ok: 'Tamam', danger: false })
})
