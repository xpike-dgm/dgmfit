import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canEnter, inviteUsable, normalizeInvite, isStatus, INVITE_ALPHABET } from '../lib/access.ts'

test('beyaz liste: yalnızca onaylı ya da yönetici girer', () => {
  assert.equal(canEnter('approved', false), true)
  for (const s of ['pending', 'rejected', 'suspended', 'x']) assert.equal(canEnter(s, false), false)
  for (const s of ['pending', 'rejected', 'suspended']) assert.equal(canEnter(s, true), true)
})

test('davet kodu: kapalı, süresi dolmuş ya da hakkı bitmiş kod kullanılamaz', () => {
  const now = new Date('2026-11-05T12:00:00Z')
  const base = { maxUses: null, uses: 0, expiresAt: null, disabled: false }
  assert.equal(inviteUsable(base, now), true)
  assert.equal(inviteUsable(null, now), false)
  assert.equal(inviteUsable({ ...base, disabled: true }, now), false)
  assert.equal(inviteUsable({ ...base, expiresAt: new Date('2026-11-05T11:59:00Z') }, now), false)
  assert.equal(inviteUsable({ ...base, expiresAt: new Date('2026-11-06T00:00:00Z') }, now), true)
  assert.equal(inviteUsable({ ...base, maxUses: 3, uses: 2 }, now), true)
  assert.equal(inviteUsable({ ...base, maxUses: 3, uses: 3 }, now), false)
})

test('davet kodu biçimi: büyük harf, boşluk/simge temizlenir; karışan karakter yok', () => {
  assert.equal(normalizeInvite('  k7m2-pq9x '), 'K7M2-PQ9X')
  assert.equal(normalizeInvite('ab cd!'), 'ABCD')
  for (const c of '01OI') assert.equal(INVITE_ALPHABET.includes(c), false)
  assert.equal(isStatus('approved'), true); assert.equal(isStatus('banned'), false)
})
