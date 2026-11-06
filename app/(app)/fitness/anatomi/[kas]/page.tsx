import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { anatomyViews, muscleFeed } from '@/lib/anatomy-data'
import { AG_MUSCLE_TR } from '@/lib/licensed'
import { getToday } from '@/lib/today'
import ExerciseFeed from '../ExerciseFeed'

export const metadata: Metadata = { title: 'Kas hareketleri · DgFit' }

export default async function Page(props: { params: Promise<{ kas: string }>; searchParams: Promise<{ g?: string }> }) {
  const u = await requireUser()
  const { kas } = await props.params
  const { g } = await props.searchParams
  const views = anatomyViews()
  if (!views || !Object.hasOwn(AG_MUSCLE_TR, kas)) notFound()
  const gender = g === 'female' || g === 'male' ? g : (await getToday(u.id))?.profile.sex === 'female' ? 'female' : 'male'
  const items = await muscleFeed(u.id, kas)
  const mine = Object.fromEntries(Object.entries(views).filter(([, v]) => v.gender === gender)) // yalnızca seçili cinsiyetin iki görünümü
  return <ExerciseFeed title={AG_MUSCLE_TR[kas]} items={items} views={mine} gender={gender} back="/fitness/anatomi" />
}
