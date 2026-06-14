import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // AI training & aggressive SEO crawlers — block entirely
      { userAgent: 'Amazonbot',    disallow: '/' },
      { userAgent: 'GPTBot',       disallow: '/' },
      { userAgent: 'ClaudeBot',    disallow: '/' },
      { userAgent: 'anthropic-ai', disallow: '/' },
      { userAgent: 'Bytespider',   disallow: '/' },
      { userAgent: 'CCBot',        disallow: '/' },
      { userAgent: 'omgili',       disallow: '/' },
      { userAgent: 'omgilibot',    disallow: '/' },
      { userAgent: 'SemrushBot',   disallow: '/' },
      { userAgent: 'AhrefsBot',    disallow: '/' },
      { userAgent: 'MJ12bot',      disallow: '/' },
      { userAgent: 'DotBot',       disallow: '/' },
      { userAgent: 'PetalBot',     disallow: '/' },
      { userAgent: 'Bingbot',      disallow: '/' },
      { userAgent: 'YandexBot',    disallow: '/' },
      { userAgent: 'Baiduspider',  disallow: '/' },
      // Googlebot only — allow movie/show for SEO, block watch/admin/api
      {
        userAgent: 'Googlebot',
        allow: ['/', '/movie/', '/show/'],
        disallow: ['/watch/', '/ctrl/', '/api/', '/movies', '/shows', '/search', '/watchlist', '/history'],
      },
      // Everyone else — block all dynamic pages, only allow homepage
      {
        userAgent: '*',
        disallow: ['/movie/', '/show/', '/watch/', '/ctrl/', '/api/', '/movies', '/shows', '/search', '/watchlist', '/history'],
      },
    ],
  }
}
