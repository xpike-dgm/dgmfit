import type { Metadata, Viewport } from 'next'
import { Manrope, Space_Grotesk } from 'next/font/google'
import SwRegister from '@/components/SwRegister'
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
  themeColor: '#0B0C0A',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${manrope.variable} ${grotesk.variable}`}>
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  )
}
