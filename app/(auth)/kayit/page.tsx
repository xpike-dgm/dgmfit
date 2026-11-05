import type { Metadata } from 'next'
import RegisterForm from './RegisterForm'

export const metadata: Metadata = { title: 'Kayıt ol' }

export default async function Page(props: { searchParams: Promise<{ davet?: string }> }) {
  const { davet } = await props.searchParams
  return (
    <>
      <h1 className="text-[32px] leading-tight font-extrabold tracking-tight">Hesabını oluştur</h1>
      <p className="text-mute mt-2 mb-8 text-[15px] leading-relaxed">Antrenman, kalori, yemek ve su takibin tek yerde, birbirine bağlı. Yeni hesaplar yönetici onayından sonra açılır.</p>
      <RegisterForm invite={(davet ?? '').slice(0, 64)} />
    </>
  )
}
