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
  if (!views || !(kas in AG_MUSCLE_TR)) notFound()
  const gender = g === 'female' || g === 'male' ? g : (await getToday(u.id))?.profile.sex === 'female' ? 'female' : 'male'
  const items = await muscleFeed(u.id, kas)
  return <ExerciseFeed title={AG_MUSCLE_TR[kas]} items={items} views={views} gender={gender} back="/fitness/anatomi" />
}
