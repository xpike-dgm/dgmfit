import type { Metadata, Viewport } from 'next'
import { Manrope, Space_Grotesk } from 'next/font/google'
import { cookies } from 'next/headers'
import SwRegister from '@/components/SwRegister'
import { THEME_COOKIE, parseTheme } from '@/lib/theme'
import './globals.css'

const manrope = Manrope({ subsets: ['latin', 'latin-ext'], variable: '--font-manrope', display: 'swap' })
const grotesk = Space_Grotesk({ subsets: ['latin', 'latin-ext'], variable: '--font-grotesk', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'DgFit', template: '%s · DgFit' },
  description: 'Antrenman, kalori, yemek, su ve sosyal — hepsi tek uygulamada, birbirine bağlı.',
  manifest: '/manifest.webmanifest',
  applicationName: 'DgFit',
  appleWebApp: { capable: true, title: 'DgFit', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F3F4F6' },
    { media: '(prefers-color-scheme: dark)', color: '#14161B' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Tema çerezi sunucuda okunur: ilk çizim doğru temayla gelir (otomatikte CSS sistem ayarını izler).
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value)
  return (
    <html lang="tr" className={`${manrope.variable} ${grotesk.variable}`} data-theme={theme === 'auto' ? undefined : theme}>
      <body data-mod="today">
        {children}
        <SwRegister />
      </body>
    </html>
  )
}
