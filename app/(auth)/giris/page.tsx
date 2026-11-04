import type { Metadata } from 'next'
import LoginForm from './LoginForm'

export const metadata: Metadata = { title: 'Giriş yap' }

export default function Page() {
  return (
    <>
      <h1 className="text-[32px] leading-tight font-extrabold tracking-tight">Tekrar hoş geldin</h1>
      <p className="text-mute mt-2 mb-8 text-[15px] leading-relaxed">Kaldığın yerden devam et.</p>
      <LoginForm />
    </>
  )
}
