import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="w-full bg-surface border-t border-white/[0.03] mt-20 py-12 flex flex-col items-center justify-center relative z-10">
      <Link href="/" className="font-display text-3xl tracking-[0.2em] text-white drop-shadow mb-8 hover:text-primary transition-colors">
        MOVORA
      </Link>
      
      <div className="flex items-center justify-center gap-6 sm:gap-10 text-sm font-medium text-white/50 mb-8 flex-wrap">
        <Link href="/about" className="hover:text-primary transition-colors">About us</Link>
        <Link href="/vlog" className="hover:text-primary transition-colors">Vlog</Link>
        <Link href="/contact" className="hover:text-primary transition-colors">Contact</Link>
        <Link href="/report" className="hover:text-primary transition-colors">Report broken links</Link>
        <Link href="/disclaimer" className="hover:text-primary transition-colors">Disclaimer</Link>
      </div>

      <div className="text-xs text-white/20">
        © {new Date().getFullYear()} AGENCY. All rights reserved.
      </div>
    </footer>
  )
}
