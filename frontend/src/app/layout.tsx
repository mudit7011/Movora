import type { Metadata, Viewport } from 'next'
import { Outfit } from 'next/font/google'
import { UserDataProvider } from '@/lib/useUserData'
import { TvProvider } from '@/components/TvProvider'
import Footer from '@/components/Footer'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import './globals.css'

const outfit = Outfit({ 
  subsets: ['latin'], 
  variable: '--font-outfit',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Movora — Premium Movie Streaming',
  description: 'Stream the latest movies in stunning HD. Your premium destination for English, Hindi, and Hindi Dubbed films.',
  keywords: ['movies', 'streaming', 'HD', 'watch online', 'Hindi movies', 'English movies'],
  manifest: '/manifest.webmanifest',
  applicationName: 'Movora',
  appleWebApp: {
    capable: true,
    title: 'Movora',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} bg-background`}>
      <body className="bg-background text-foreground font-sans antialiased min-h-screen">
        <TvProvider>
          <UserDataProvider>
            {children}
            <Footer />
          </UserDataProvider>
        </TvProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
