import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { aiAvailable, aiSettings, userCallsToday } from '@/lib/ai/engine'
import { PERSONAS } from '@/lib/ai/schemas'
import { coachPrefs, conversationMessages, listConversations } from '@/lib/coach-data'
import CoachChat from './CoachChat'

export const metadata: Metadata = { title: 'Koç · DgFit' }

export default async function Page(props: { searchParams: Promise<{ s?: string; yeni?: string; soru?: string; ayarlar?: string }> }) {
  const u = await requireUser()
  const sp = await props.searchParams
  const [convs, prefs, on, used, settings] = await Promise.all([listConversations(u.id), coachPrefs(u.id), aiAvailable(), userCallsToday(u.id), aiSettings()])
  const current = sp.yeni ? null : convs.find((c) => c.id === sp.s) ?? convs[0] ?? null
  const messages = current ? await conversationMessages(u.id, current.id) : []
  return (
    <CoachChat key={current?.id ?? 'yeni'} aiOn={on} conversationId={current?.id ?? null} initial={messages} draft={sp.soru?.slice(0, 300) ?? ''} openSettings={sp.ayarlar === '1'}
      conversations={convs.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString() }))}
      prefs={{ persona: prefs.persona, insights: prefs.insights, weeklyPush: prefs.weeklyPush }}
      personas={Object.entries(PERSONAS).map(([id, p]) => ({ id, label: p.label, hint: p.hint }))}
      left={Math.max(0, settings.userDaily - used)} />
  )
}
