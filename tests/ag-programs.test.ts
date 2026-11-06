import { test } from 'node:test'
import assert from 'node:assert/strict'
import { agKeyResolver, agProgramDays, agSummary, dayNameTr, noteTr, type AgProgram } from '../lib/ag-programs.ts'

// Uydurma örnek (paket içeriği depoya girmez)
const prog: AgProgram = {
  id: '00000000-0000-0000-0000-000000000001', index: 1, name: 'Test Program', type: 'Free', level: 'Beginner', numberOfWorkouts: 2,
  trainingEnvironments: ['Home Gym'], equipment: ['Dumbbell'], targetMuscles: ['Total Body'], goals: ['Strength'], descriptions: { tr: ' Açıklama ', en: 'Desc' },
  workouts: [
    { name: 'Workout A', weekday: 'Monday', exerciseEntries: [
      { name: 'Goblet Squat', sets: 4, repsRange: [12, 8], restTimeInMinutes: 1, restTimeInSeconds: 30, rir: 0.5 },
      { name: 'Push Up', sets: 3, note: 'Max reps' },
      { name: 'Superset', sets: 3, restTimeInSeconds: 45, subExercises: [{ name: 'Curl', reps: 10 }, { name: 'Plank', timeInSeconds: 30 }, { name: 'Unknown Move', reps: 5 }] },
      { name: 'Superset', sets: 2, subExercises: [{ name: 'Lunge', reps: 10, note: 'both sides' }, { name: 'Missing', reps: 10 }] },
    ] },
    { name: '', weekday: null, exerciseEntries: [{ name: 'Wall Sit', sets: 2, timeInMinutes: 1 } as never] },
  ],
}
const keys: Record<string, string> = { 'Goblet Squat': 'ag-1', 'Push Up': 'Pushups', Curl: 'ag-3', Plank: 'ag-4', Lunge: 'ag-5', 'Wall Sit': 'ag-6' }

test('program dönüşümü: aralık, dinlenme, RiR, AMRAP, süperset grubu, süre, not, eksik hareket', () => {
  const { days, missing } = agProgramDays(prog, (n) => keys[n] ?? null)
  assert.deepEqual(missing, ['Unknown Move', 'Missing'])
  assert.equal(days[0].name, 'Antrenman A'); assert.equal(days[0].focus, 'Pazartesi'); assert.equal(days[1].name, 'Gün 2')
  const [sq, pu, curl, plank, lunge] = days[0].exercises
  assert.deepEqual([sq.repMin, sq.repMax, sq.rest, sq.rir, sq.sets, sq.role, sq.superset], [8, 12, 90, 0, 4, 'ana', null])
  assert.deepEqual([pu.type, pu.repMin, pu.repMax, pu.rir, pu.note], ['amrap', 5, 30, 0, 'maksimum tekrar'])
  assert.deepEqual([curl.superset, plank.superset, curl.type, curl.rest, curl.repMin, curl.repMax], [1, 1, 'normal', 45, 10, 10])
  assert.equal(plank.seconds, 30)
  // grubun ikinci üyesi eksik → tek kalan normal harekete döner
  assert.deepEqual([lunge.superset, lunge.type, lunge.note], [null, 'normal', 'iki taraf'])
  assert.equal(days[0].exercises.length, 5)
  assert.equal(days[1].exercises[0].seconds, 60) // dakika cinsinden süre saniyeye çevrilir
  // dinlenme düzenleyicinin aralığında (15–600 sn)
  const odd = agProgramDays({ ...prog, workouts: [{ name: 'X', weekday: null, exerciseEntries: [{ name: 'Goblet Squat', sets: 3, reps: 5, restTimeInSeconds: 5 }, { name: 'Push Up', sets: 3, reps: 5, restTimeInMinutes: 15 }] }] }, (n) => keys[n] ?? null)
  assert.deepEqual(odd.days[0].exercises.map((e) => e.rest), [15, 600])
})

test('özet ve etiketler', () => {
  const s = agSummary(prog)
  assert.equal(s.id, 'ag-00000000-0000-0000-0000-000000000001'); assert.equal(s.level, 'Başlangıç'); assert.equal(s.levelKey, 'new')
  assert.deepEqual(s.env, ['Ev']); assert.equal(s.home, true); assert.deepEqual(s.targets, ['Tüm vücut']); assert.equal(s.description, 'Açıklama'); assert.equal(s.supersets, 2)
  assert.equal(dayNameTr('Push', 0), 'İtiş'); assert.equal(dayNameTr('Özel Gün', 0), 'Özel Gün')
  assert.equal(noteTr('Max Reps'), 'maksimum tekrar'); assert.equal(noteTr('tempo 3-1-1'), 'tempo 3-1-1'); assert.equal(noteTr(''), '')
})

test('ad çözücü: ag kimliği üzerinden + takma adlar', () => {
  const r = agKeyResolver(new Map([['Inverted Biceps Curl', 371], ['Push Up', 2]]), new Map([[371, 'ag-371'], [2, 'Pushups']]), new Set(['Speed_Band_Overhead_Triceps']))
  assert.equal(r('Push Up'), 'Pushups'); assert.equal(r('Biceps Curl Banded'), 'ag-371'); assert.equal(r('Triceps Overhead Extension Banded'), 'Speed_Band_Overhead_Triceps')
  assert.equal(r('Nope'), null)
  assert.equal(agKeyResolver(new Map(), new Map(), new Set())('Triceps Overhead Extension Banded'), null)
})
