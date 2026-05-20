import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="w-full bg-surface border-t border-white/[0.03] mt-20 py-12 flex flex-col items-center justify-center relative z-10">
      <Link href="/" className="font-display text-3xl tracking-[0.2em] text-white drop-shadow mb-8 hover:text-primary transition-colors">
        MOVORA
      </Link>
      
      <div className="flex items-center justify-center gap-6 sm:gap-10 text-sm font-medium text-white/50 mb-8 flex-wrap">
        <Link href="/dmca" className="hover:text-primary transition-colors">DMCA</Link>
        <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
        <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
        <a href="mailto:dmca@movora.app" className="hover:text-primary transition-colors">Report Content</a>
      </div>

      <p className="text-xs text-white/20 max-w-xl text-center mb-3 px-4">
        Movora is a search engine that indexes publicly available streaming links. We do not host or
        store any media content. All rights belong to their respective owners.
      </p>

      <div className="text-xs text-white/20">
        © {new Date().getFullYear()} Movora. All rights reserved.
      </div>
    </footer>
  )
}
