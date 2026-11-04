import type { Metadata } from 'next'
import RegisterForm from './RegisterForm'

export const metadata: Metadata = { title: 'Kayıt ol' }

export default function Page() {
  return (
    <>
      <h1 className="text-[32px] leading-tight font-extrabold tracking-tight">Hesabını oluştur</h1>
      <p className="text-mute mt-2 mb-8 text-[15px] leading-relaxed">Antrenman, kalori, yemek ve su takibin tek yerde, birbirine bağlı.</p>
      <RegisterForm />
    </>
  )
}
