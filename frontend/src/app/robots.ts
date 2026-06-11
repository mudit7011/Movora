import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // AI training crawlers — no value, pure cost
      { userAgent: 'Amazonbot',      disallow: '/' },
      { userAgent: 'GPTBot',         disallow: '/' },
      { userAgent: 'ClaudeBot',      disallow: '/' },
      { userAgent: 'anthropic-ai',   disallow: '/' },
      { userAgent: 'Bytespider',     disallow: '/' },
      { userAgent: 'CCBot',          disallow: '/' },
      { userAgent: 'omgili',         disallow: '/' },
      { userAgent: 'omgilibot',      disallow: '/' },
      // SEO auditors that crawl aggressively
      { userAgent: 'SemrushBot',     disallow: '/' },
      { userAgent: 'AhrefsBot',      disallow: '/' },
      { userAgent: 'MJ12bot',        disallow: '/' },
      { userAgent: 'DotBot',         disallow: '/' },
      { userAgent: 'PetalBot',       disallow: '/' },
      // Everyone else: allow content, block admin + internal API
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/ctrl/', '/api/ctrl/', '/api/debug/'],
      },
    ],
  }
}
