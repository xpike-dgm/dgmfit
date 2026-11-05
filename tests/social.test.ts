import { test } from 'node:test'
import assert from 'node:assert/strict'
import { feedScore, itemVisible, longestWeekStreak, milestoneText, postVisible, profileAccess, suggestionScore } from '../lib/social.ts'
import { combine, moderateText } from '../lib/moderation.ts'

test('profil erişimi: görünürlük × ilişki', () => {
  assert.deepEqual(profileAccess('none', 'private'), { basic: false, detail: false, canRequest: false, canFollow: false })
  assert.deepEqual(profileAccess('none', 'friends'), { basic: true, detail: false, canRequest: true, canFollow: false })
  assert.deepEqual(profileAccess('none', 'public'), { basic: true, detail: true, canRequest: true, canFollow: true })
  assert.equal(profileAccess('follower', 'public').canFollow, false)
  assert.equal(profileAccess('friend', 'private').detail, true)
  assert.equal(profileAccess('blocked', 'public').basic, false)
})

test('öğe görünürlüğü: varsayılan kapalı, takipçi yalnızca herkese açık', () => {
  assert.equal(itemVisible('friend', 'friends', 'none'), false)
  assert.equal(itemVisible('friend', 'friends', 'friends'), true)
  assert.equal(itemVisible('follower', 'public', 'friends'), false)
  assert.equal(itemVisible('follower', 'public', 'public'), true)
  assert.equal(itemVisible('none', 'friends', 'public'), false) // profil açık değilse yabancıya kapalı
  assert.equal(itemVisible('self', 'private', 'none'), true)
})

test('gönderi görünürlüğü: kitle, seçilenler, moderasyon', () => {
  const p = (audience: 'public' | 'friends' | 'selected', ids: string[] = [], moderation = 'ok') => ({ audience, audienceIds: ids, moderation })
  assert.equal(postVisible('friend', p('friends'), 'v', 'friends'), true)
  assert.equal(postVisible('follower', p('friends'), 'v', 'public'), false)
  assert.equal(postVisible('follower', p('public'), 'v', 'public'), true)
  assert.equal(postVisible('none', p('public'), 'v', 'friends'), false)
  assert.equal(postVisible('friend', p('selected', ['x']), 'v', 'public'), false)
  assert.equal(postVisible('friend', p('selected', ['v']), 'v', 'public'), true)
  assert.equal(postVisible('friend', p('friends', [], 'pending'), 'v', 'public'), false)
  assert.equal(postVisible('self', p('friends', [], 'hidden'), 'v', 'public'), true)
})

test('akış puanı: yakın arkadaş ve başarı öne, yenilik azalır', () => {
  const now = Date.now()
  const base = { createdAt: now - 3600_000, kind: 'text', close: false, reactions: 0, comments: 0, mine: false }
  assert.ok(feedScore({ ...base, close: true }, now) > feedScore(base, now))
  assert.ok(feedScore({ ...base, kind: 'pr' }, now) > feedScore(base, now))
  assert.ok(feedScore({ ...base, createdAt: now - 48 * 3600_000, kind: 'pr' }, now) < feedScore(base, now))
})

test('öneri, kilometre taşı, haftalık seri', () => {
  assert.equal(suggestionScore({ mutual: 2, sameGym: true, sameGoal: true }), 11)
  assert.equal(milestoneText(85, 79, 'lose'), '−6 kg hedef yolculuğunda')
  assert.equal(milestoneText(85, 84.5, 'lose'), null)
  assert.equal(longestWeekStreak(['2026-10-05', '2026-10-13', '2026-10-21', '2026-11-04']), 3) // 3 ardışık hafta, sonra boşluk
  assert.equal(longestWeekStreak([]), 0)
})

test('moderasyon kuralları', () => {
  assert.equal(moderateText('Bugün squat 100 kg! 💪').verdict, 'ok')
  assert.deepEqual(moderateText('Sen tam bir şişko').reasons, ['hakaret/taciz'])
  assert.ok(moderateText('Günde 500 kalori ile 2 haftada 8 kilo').reasons.includes('zararlı diyet içeriği'))
  assert.equal(moderateText('Günde 2000 kalori hedefim var').verdict, 'ok')
  const ed = moderateText('Yemekten sonra kusuyorum')
  assert.equal(ed.support, 'ed')
  assert.equal(ed.verdict, 'review')
  assert.equal(combine(moderateText('selam'), { verdict: 'block', reasons: ['uygunsuz görsel'] }).verdict, 'block')
  assert.equal(combine(moderateText('selam'), null).verdict, 'ok')
})
