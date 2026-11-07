import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contestOpen, contestWinner, publicTemplateUrl, safeUrl, visibleAnnouncement, voteError } from '../lib/cards/community.ts'

test('yarışma: kendi haftasında açık; kazanan en çok oy, eşitlikte önce katılan; oysuzsa yok', () => {
  assert.ok(contestOpen('2026-11-02', '2026-11-07')); assert.ok(!contestOpen('2026-11-02', '2026-11-09'))
  const d = (h: number) => new Date(Date.UTC(2026, 10, 3, h))
  assert.equal(contestWinner([{ templateId: 'a', userId: '1', votes: 3, createdAt: d(5) }, { templateId: 'b', userId: '2', votes: 3, createdAt: d(2) }, { templateId: 'c', userId: '3', votes: 1, createdAt: d(1) }])!.templateId, 'b')
  assert.equal(contestWinner([{ templateId: 'a', userId: '1', votes: 0, createdAt: d(1) }]), null)
  assert.equal(contestWinner([]), null)
})

test('oy hakkı: kapalı yarışma ve kendi şablonu reddedilir', () => {
  assert.equal(voteError({ open: false, voterId: 'x', entryOwnerId: 'y' }), 'Yarışma kapandı')
  assert.equal(voteError({ open: true, voterId: 'x', entryOwnerId: 'x' }), 'Kendi tasarımına oy veremezsin')
  assert.equal(voteError({ open: true, voterId: 'x', entryOwnerId: 'y' }), null)
})

test('duyuru: etkin, süresi geçmemiş, kapatılmamış en yeni', () => {
  const now = new Date('2026-11-07T10:00:00Z'), t = (h: number) => new Date(now.getTime() + h * 3600_000)
  const list = [
    { id: 'old', title: 'a', active: true, endsAt: null, createdAt: t(-48) },
    { id: 'new', title: 'b', active: true, endsAt: t(5), createdAt: t(-1) },
    { id: 'off', title: 'c', active: false, endsAt: null, createdAt: t(-0.5) },
    { id: 'exp', title: 'd', active: true, endsAt: t(-1), createdAt: t(-0.2) },
  ]
  assert.equal(visibleAnnouncement(list, new Set(), now)!.id, 'new')
  assert.equal(visibleAnnouncement(list, new Set(['new']), now)!.id, 'old')
  assert.equal(visibleAnnouncement(list, new Set(['new', 'old']), now), null)
})

test('güvenli bağlantı ve girişsiz önizleme adresi', () => {
  assert.equal(safeUrl('/profil/ozellestirme/sablonlar'), '/profil/ozellestirme/sablonlar')
  assert.equal(safeUrl('https://ornek.com/x'), 'https://ornek.com/x')
  for (const bad of ['javascript:alert(1)', '//evil.com', 'http://x.com', 'data:text/html,1']) assert.equal(safeUrl(bad), null, bad)
  assert.equal(safeUrl(''), null)
  assert.equal(publicTemplateUrl('https://dgfit.dgmcraft.online/', 'abc'), 'https://dgfit.dgmcraft.online/t/abc')
})
