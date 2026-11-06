// Faz 9: uzun dönem senaryo simülasyonu — hızlı set (~300 senaryo). Tam set: `node --experimental-strip-types scripts/sim.mjs full`
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { scenarioSet } from '../lib/sim/scenarios.ts'
import { goldenOf, runScenario } from '../lib/sim/run.ts'

test('simülasyon (hızlı set): değişmez ihlali yok ve sonuçlar altın dosyayla aynı', () => {
  const golden = JSON.parse(fs.readFileSync('tests/sim/golden-fast.json', 'utf8')) as Record<string, string>
  const errs: string[] = []
  const changed: string[] = []
  for (const s of scenarioSet(300, 's')) {
    const r = runScenario(s)
    for (const f of r.findings) if (f.severity === 'error') errs.push(`${r.id} ${f.code}: ${f.detail}`)
    const g = goldenOf(r)
    if (golden[r.id] !== g) changed.push(`${r.id}: ${golden[r.id]} → ${g}`)
  }
  assert.deepEqual(errs.slice(0, 10), [], 'değişmez ihlalleri')
  assert.deepEqual(changed.slice(0, 15), [], 'altın dosyadan farklı (bilinçli değişiklikse: node --experimental-strip-types scripts/sim.mjs fast --update)')
})

test('simülasyon: kullanıcı örneği 78 → 80 kg kas hedefi (200 gün) planı ve vücut modeli makul', () => {
  const s = scenarioSet(0).find((x) => x.id === 'ornek-78-80-kas-200g')!
  const r = runScenario(s)
  assert.equal(r.planDays, 200)
  assert.ok(r.reachedDay !== null && r.reachedDay < 200, 'acemi + antrenman: hedefe plandan önce ulaşır')
  assert.ok(r.leanChange > 0.5, 'antrenman + protein ile yağsız kütle artar: ' + r.leanChange)
})
