'use client'
// Özelleştirme Ö1b-2: kullanım tercihleri (tek el, basılı tutunca düzenle) istemci bileşenlerine bağlamla iner.
import { createContext, useContext, type ReactNode } from 'react'
import type { UsePrefs } from '@/lib/cards/prefs'

const Ctx = createContext<UsePrefs>({ hand: null, holdToEdit: true })
export function DesignPrefsProvider({ value, children }: { value: UsePrefs; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export const useDesignPrefs = () => useContext(Ctx)
