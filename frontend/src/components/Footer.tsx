import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="lg:pl-24 w-full border-t border-white/[0.06] mt-20 py-12 relative z-10 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">

        {/* Logo */}
        <Link href="/" className="mb-6 select-none">
          <span className="text-2xl font-bold tracking-tight">
            <span className="text-foreground">Mo</span><span className="text-primary">vora</span>
          </span>
        </Link>

        {/* Tagline */}
        <p className="text-xs text-muted-foreground text-center max-w-md mb-8 leading-relaxed">
          Movora is a search engine that indexes publicly available streaming links.
          We do not host, store, or transmit any media content.
          All rights belong to their respective owners.
        </p>

        {/* Links */}
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground mb-8">
          <Link href="/" className="hover:text-primary transition-colors">Home</Link>
          <Link href="/movies" className="hover:text-primary transition-colors">Movies</Link>
          <Link href="/shows" className="hover:text-primary transition-colors">TV Shows</Link>
          <Link href="/new" className="hover:text-primary transition-colors">New & Popular</Link>
          <span className="hidden sm:block w-px h-4 bg-white/10" />
          <Link href="/dmca" className="hover:text-primary transition-colors">DMCA Takedown</Link>
          <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
          <a href="mailto:dmca@movora.online" className="hover:text-primary transition-colors">Report Content</a>
        </div>

        {/* Divider */}
        <div className="w-full max-w-2xl h-px bg-white/[0.06] mb-6" />

        {/* Bottom row */}
        <div className="flex flex-col sm:flex-row items-center gap-2 text-xs text-white/25 text-center">
          <span>© {new Date().getFullYear()} Movora. All rights reserved.</span>
          <span className="hidden sm:block">·</span>
          <span>Not affiliated with any content provider.</span>
        </div>

      </div>
    </footer>
  )
}
