const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return [
      // Forward public API calls to EB backend (server-side rewrite, no mixed-content issue)
      { source: '/api/movies/:path*', destination: `${BACKEND}/api/movies/:path*` },
      { source: '/api/shows/:path*',  destination: `${BACKEND}/api/shows/:path*` },
      { source: '/api/new',           destination: `${BACKEND}/api/new` },
      { source: '/api/health',        destination: `${BACKEND}/api/health` },
    ]
  },
  images: {
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
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
