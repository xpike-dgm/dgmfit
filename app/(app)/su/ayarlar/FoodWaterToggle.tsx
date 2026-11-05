'use client'
import { useState, useTransition } from 'react'
import { setFoodWater } from '@/app/(app)/yemek/actions'

export default function FoodWaterToggle({ on }: { on: boolean }) {
  const [v, setV] = useState(on)
  const [, start] = useTransition()
  return (
    <section className="card px-5 py-4">
      <label className="flex items-center justify-between gap-4 cursor-pointer">
        <span className="flex flex-col">
          <span className="font-extrabold">Yemeklerden gelen su</span>
          <span className="text-[13px] text-mute leading-snug">Çorba, ayran, süt gibi sıvı yemeklerdeki suyu günlük suya ekle.</span>
        </span>
        <input type="checkbox" checked={v} onChange={(e) => { const x = e.target.checked; setV(x); start(async () => { await setFoodWater(x) }) }} className="w-6 h-6 shrink-0" />
      </label>
    </section>
  )
}
