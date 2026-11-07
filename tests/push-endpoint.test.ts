import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAllowedPushEndpoint as ok } from '../lib/push-endpoint.ts'

test('izinli push servisleri', () => {
  for (const u of ['https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/Q', 'https://wns2-par02p.notify.windows.com/w/?token=1', 'https://a.push.services.mozilla.com/x', 'https://x.push.apple.com/y']) assert.equal(ok(u), true, u)
})
test('reddedilenler', () => {
  for (const u of ['http://fcm.googleapis.com/x', 'https://evil.com/', 'https://fcm.googleapis.com.evil.com/', 'https://evilfcm.googleapis.com/', 'https://fcm.googleapis.com:8443/x', 'https://127.0.0.1/', 'https://localhost/', 'https://u:p@fcm.googleapis.com/', 'https://notify.windows.com/', 'https://push.apple.com/', 'nonsense', 'https://evil.com/.notify.windows.com', 'https://169.254.169.254/']) assert.equal(ok(u), false, u)
})
