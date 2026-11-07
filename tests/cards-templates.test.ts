import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeMeta, popularity, searchTerm, weekKey } from '../lib/cards/templates.ts'

test('şablon bilgisi temizlenir', () => {
  const m = normalizeMeta({ name: '  Gece   mavisi  ', description: 'Koyu  ve sakin', category: 'yok', tags: ['#Gece', 'gece', 'Mavi!', 'a', 'b', 'c', 'd'] })
  assert.equal(m.name, 'Gece mavisi'); assert.equal(m.description, 'Koyu ve sakin'); assert.equal(m.category, 'diger')
  assert.deepEqual(m.tags, ['gece', 'mavi', 'a', 'b', 'c'])
  assert.equal(normalizeMeta({ name: 'x'.repeat(80) }).name.length, 40)
})

test('popülerlik: kullanım > kaydetme > beğeni; yaşla söner', () => {
  const now = new Date('2026-11-07T12:00:00Z'), d = (n: number) => new Date(now.getTime() - n * 86_400_000)
  const a = popularity({ likes: 0, uses: 10, saves: 0, createdAt: d(1) }, now)
  const b = popularity({ likes: 30, uses: 0, saves: 0, createdAt: d(1) }, now)
  assert.ok(a > b * 0.99)
  assert.ok(popularity({ likes: 5, uses: 5, saves: 5, createdAt: d(1) }, now) > popularity({ likes: 5, uses: 5, saves: 5, createdAt: d(60) }, now))
})

test('hafta anahtarı pazartesi; arama terimi kaçışlı', () => {
  assert.equal(weekKey('2026-11-07'), '2026-11-02'); assert.equal(weekKey('2026-11-02'), '2026-11-02'); assert.equal(weekKey('2026-11-08'), '2026-11-02')
  assert.equal(searchTerm('  %50_mavi '), '%\\%50\\_mavi%'); assert.equal(searchTerm(''), null)
})
