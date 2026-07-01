const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Forward public API calls to EB backend (server-side rewrite, no mixed-content issue)
      { source: '/api/movies/:path*',   destination: `${BACKEND}/api/movies/:path*` },
      { source: '/api/shows/:path*',    destination: `${BACKEND}/api/shows/:path*` },
      { source: '/api/realtime/:path*', destination: `${BACKEND}/api/realtime/:path*` },
      { source: '/api/new',             destination: `${BACKEND}/api/new` },
      { source: '/api/search/:path*',   destination: `${BACKEND}/api/search/:path*` },
      { source: '/api/health',          destination: `${BACKEND}/api/health` },
      { source: '/api/sports/:path*',   destination: `${BACKEND}/api/sports/:path*` },
      { source: '/api/livetv/:path*',   destination: `${BACKEND}/api/livetv/:path*` },
    ]
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer-when-downgrade' },
        ],
      },
      // Prevent Vercel preview deployments from being indexed.
      // Conditional on the Host header at the CDN layer — zero function invocations.
      {
        source: '/(.*)',
        has: [{ type: 'host', value: '(?:.*)\\.vercel\\.app' }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ]
  },
}

export default nextConfig
