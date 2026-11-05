import { test } from 'node:test'
import assert from 'node:assert/strict'
// @ts-expect-error — düz JS modülü (migrate.mjs ile ortak), tip bildirimi yok
import { agToExercise, buildMatcher, cleanDesc, looseName, videoFile } from '../scripts/licensed-map.mjs'

const squat = {
  id: 12, parameters: { name: 'Barbell Squat' }, equipment: 'barbell', level: 'experienced', cnsFatingScore: 8, specialFeature: ['overload'],
  musclesTrains: [{ muscleGroup: 'quads', rating: 9 }, { muscleGroup: 'glutes', rating: 8 }, { muscleGroup: 'adductors', rating: 6 }, { muscleGroup: 'spinalErectors', rating: 5 }, { muscleGroup: 'hipFlexors', rating: 3 }],
  rightVideo: 'https://x.example/AppVideos/BarbellSquatRight.mp4', wrongVideo: 'https://x.example/AppVideos/BarbellSquatWrong.mp4',
  descriptions: { tr: 'test test test', en: 'A key lower body strength exercise performed with a barbell on the back.' },
}

test('hareket eşlemesi: kas puanı → birincil/ikincil, ekipman, seviye, tür, örüntü, video dosyası', () => {
  const e = agToExercise(squat)
  assert.equal(e.key, 'ag-12'); assert.equal(e.equipment, 'barbell'); assert.equal(e.level, 'intermediate')
  assert.deepEqual(e.primary, ['quadriceps', 'glutes']); assert.deepEqual(e.secondary, ['adductors', 'lower back'])
  assert.equal(e.kind, 'weight_reps'); assert.equal(e.pattern, 'legs'); assert.equal(e.mechanic, 'compound')
  assert.equal(e.licensed.muscles.hipFlexors, 3) // karşılığı yok ama puan korunur
  assert.deepEqual(e.licensed.video, { right: 'BarbellSquatRight.mp4', wrong: 'BarbellSquatWrong.mp4' })
  assert.equal(e.licensed.desc.tr, ''); assert.match(e.licensed.desc.en, /lower body/)
  assert.equal(agToExercise({ ...squat, parameters: { name: 'Plank Hold' }, equipment: 'bodyWeight' }).kind, 'time')
  assert.equal(agToExercise({ ...squat, parameters: { name: 'Pull Up' }, equipment: 'pullUpBar' }).kind, 'bodyweight')
})

test('ad eşleşmesi: birebir ve gevşek (çoğul, tire, tutuş)', () => {
  const m = buildMatcher([{ key: 'Barbell_Squat', name: 'Barbell Squat' }, { key: 'Pullups', name: 'Pullups' }, { key: 'Dumbbell_Step_Ups', name: 'Dumbbell Step Ups' }, { key: 'BB', name: 'Barbell Bench Press - Medium Grip' }])
  assert.equal(m('Barbell Squat'), 'Barbell_Squat'); assert.equal(m('Pull Up'), 'Pullups'); assert.equal(m('Dumbbell Step Up'), 'Dumbbell_Step_Ups')
  assert.equal(m('Barbell Bench Press'), 'BB'); assert.equal(m('Arnold Press'), null)
  assert.equal(looseName('Push-Ups'), looseName('Push Up'))
})

test('açıklama ve video adı süzgeci', () => {
  assert.equal(cleanDesc('test test test'), ''); assert.equal(cleanDesc('kısa'), ''); assert.equal(cleanDesc(null), '')
  assert.equal(videoFile('https://a/b/C_d-1.mp4'), 'C_d-1.mp4'); assert.equal(videoFile('https://a/b/../../etc'), null)
})
