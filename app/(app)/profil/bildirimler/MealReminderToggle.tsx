'use client'
import { useState, useTransition } from 'react'
import { setMealRemindersAction } from '../actions'

/** P-7: akıllı öğün hatırlatması (alışkanlık saatinden 1 saat sonra kayıt yoksa, öğün başına günde bir). */
export default function MealReminderToggle({ on }: { on: boolean }) {
  const [v, setV] = useState(on)
  const [pending, start] = useTransition()
  return (
    <label className="card px-4 py-3 flex items-center justify-between gap-3 min-h-[64px] cursor-pointer" data-testid="meal-reminders">
      <span className="flex flex-col">
        <b className="text-[15px]">Öğün hatırlatmaları</b>
        <span className="text-[13px] text-mute leading-snug">Genelde kaydettiğin saatten 1 saat sonra hâlâ kayıt yoksa, öğün başına günde en fazla bir bildirim</span>
      </span>
      <input type="checkbox" checked={v} disabled={pending} onChange={(e) => { const x = e.target.checked; setV(x); start(async () => { await setMealRemindersAction(x) }) }} aria-label="Öğün hatırlatmaları" />
    </label>
  )
}
