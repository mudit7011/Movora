import Link from 'next/link'
import { RetroTvError } from '@/components/ui/404-error-page'

export default function NotFound() {
  return (
    <div className="relative min-h-screen bg-background flex flex-col items-center justify-center overflow-hidden">
      {/* Grain texture */}
      <div className="grain absolute inset-0 pointer-events-none z-0" />

      {/* Ambient glow orbs */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(6,214,224,0.07) 0%, transparent 70%)',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
          bottom: '15%',
          right: '10%',
          filter: 'blur(60px)',
        }}
      />

      {/* Movora logo */}
      <Link href="/" className="absolute top-8 left-8 select-none z-10">
        <span className="text-2xl font-bold tracking-tight">
          <span className="text-foreground">Mo</span>
          <span className="text-primary">vora</span>
        </span>
      </Link>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-4 text-center">
        <RetroTvError
          errorCode="404"
          errorMessage="NOT FOUND"
          className="scale-75 sm:scale-90 lg:scale-100"
        />

        {/* Tagline */}
        <div className="flex flex-col items-center gap-3 -mt-4">
          <p className="text-muted-foreground text-base sm:text-lg max-w-md leading-relaxed">
            Looks like this signal got lost in the void.{' '}
            <span className="text-primary">No content found</span> at this frequency.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
          <Link
            href="/"
            className="btn-primary inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
            </svg>
            Go Home
          </Link>
          <Link
            href="/movies"
            className="btn-glass inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.14v14l11-7-11-7z" />
            </svg>
            Browse Movies
          </Link>
        </div>
      </div>
    </div>
  )
}
