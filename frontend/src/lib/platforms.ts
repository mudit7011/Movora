export interface PlatformConfig {
  slug: string
  name: string
  providerId: number
  bg: string
}

export const PLATFORMS: PlatformConfig[] = [
  { slug: 'netflix',      name: 'Netflix',      providerId: 8,    bg: 'linear-gradient(135deg,#E50914,#B20710)' },
  { slug: 'prime',        name: 'Prime Video',  providerId: 9,    bg: 'linear-gradient(135deg,#0F2F4E,#1A4A6B)' },
  { slug: 'apple-tv',     name: 'Apple TV+',    providerId: 350,  bg: 'linear-gradient(135deg,#1c1c1e,#3a3a3c)' },
  { slug: 'max',          name: 'Max',          providerId: 1899, bg: 'linear-gradient(135deg,#001a4d,#002BE7)' },
  { slug: 'disney-plus',  name: 'Disney+',      providerId: 337,  bg: 'linear-gradient(135deg,#040714,#113CCF)' },
  { slug: 'hulu',         name: 'Hulu',         providerId: 15,   bg: 'linear-gradient(135deg,#0d1f0d,#1CE783)' },
]

export function getPlatformBySlug(slug: string): PlatformConfig | undefined {
  return PLATFORMS.find(p => p.slug === slug)
}
