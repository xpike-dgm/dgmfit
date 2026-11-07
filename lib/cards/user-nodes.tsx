import 'server-only'
// Ö5a: ekrandaki kendi kartlarımın çizimleri (sayfalar `nodes`'a ekler). Yalnız düzende/yığında duran (düzenlemede
// çekmecedekiler de) kartlar hesaplanır.
import type { ReactNode } from 'react'
import UserCardView from '@/components/cards/UserCardView'
import { isUserCard, type UserCard } from './custom'
import { userCardData } from './custom-data'

export async function userNodes(userId: string, layout: { items: { id: string; stack?: string[] }[]; drawer: { def: { id: string } }[]; userCards: Record<string, UserCard> }, editing = false): Promise<Record<string, ReactNode>> {
  const ids = [...layout.items.flatMap((i) => [i.id, ...(i.stack ?? [])]), ...(editing ? layout.drawer.map((d) => d.def.id) : [])].filter(isUserCard)
  if (!ids.length) return {}
  const data = await userCardData(userId, layout.userCards, ids)
  return Object.fromEntries(ids.map((id) => [id, <UserCardView key={id} id={id} data={data[id]} />]))
}
