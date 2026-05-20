import type { Metadata, Viewport } from 'next'
import { Outfit } from 'next/font/google'
import { UserDataProvider } from '@/lib/useUserData'
import Footer from '@/components/Footer'
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
}

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} bg-background`}>
      <body className="bg-background text-foreground font-sans antialiased min-h-screen">
        <UserDataProvider>
          {children}
          <Footer />
        </UserDataProvider>
      </body>
    </html>
  )
}
