import type { Metadata } from 'next'
import { Inter, Bebas_Neue } from 'next/font/google'
import Navbar from '@/components/Navbar'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const bebas = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
})

export const metadata: Metadata = {
  title: 'Movora — Watch Movies Online',
  description: 'Stream the latest movies in HD — English, Hindi, and Hindi Dubbed.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${bebas.variable}`}>
      <body className="bg-base text-white font-sans antialiased">
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  )
}
