// ─── Anime source extractor (AniList-mapped, via Anivexa API) ────────────────────────────────────
// Our catalog is TMDB-keyed, but anime streaming providers index by AniList id, and AniList carries
// far richer anime metadata (accurate per-season episode counts, romaji/native titles, studios) than
// TMDB (which lumps every season under one tv id). We bridge TMDB→AniList with the Fribb anime-lists
// map, then resolve HLS + subtitles through a self-hosted Anivexa instance (multi-provider aggregator:
// AniZone, Anikoto, AnimeGG, Reanime… — one provider dies, the next covers). All providers return
// H.264 HLS (no HEVC drama) and are reachable from a datacenter IP, so this runs on Render directly.
//
// Anivexa runs as a separate zero-dep Node service; the backend calls it via ANIME_API_URL (mirrors
// the MovieBox MB_EXTRACT_URL delegation). Unset → anime sourcing is disabled (no-op).

const ANIME_API_URL = (process.env.ANIME_API_URL || '').replace(/\/$/, '')
const FRIBB_URL = 'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json'

export interface AnimeSource { server: string; lang: string; url: string; referer: string; type: 'hls' | 'mp4'; subtitles?: SubTrack[] }
export interface SubTrack { url: string; label: string; lang: string }

// ── Fribb TMDB→AniList map (lazy, cached in memory, refreshed daily) ──
interface FribbEntry { type?: string; anilist_id?: number; themoviedb_id?: number | { tv?: number; movie?: number } }
let fribbCache: { byTmdb: Map<string, number[]>; ts: number } | null = null
const FRIBB_TTL = 24 * 60 * 60 * 1000

const tmdbOf = (x: FribbEntry): number | null => {
  const t = x.themoviedb_id
  if (t == null) return null
  if (typeof t === 'number') return t
  return t.tv ?? t.movie ?? null
}

async function loadFribb(): Promise<Map<string, number[]>> {
  if (fribbCache && Date.now() - fribbCache.ts < FRIBB_TTL) return fribbCache.byTmdb
  try {
    const r = await fetch(FRIBB_URL, { signal: AbortSignal.timeout(15_000) })
    const list: FribbEntry[] = await r.json()
    // Key "movie:<id>" / "tv:<id>" → ordered list of anilist ids (order ≈ season sequence).
    const byTmdb = new Map<string, number[]>()
    for (const x of list) {
      const tid = tmdbOf(x)
      if (!tid || !x.anilist_id) continue
      const kind = x.type === 'MOVIE' ? 'movie' : 'tv'
      const key = `${kind}:${tid}`
      const arr = byTmdb.get(key) || []
      arr.push(x.anilist_id)
      byTmdb.set(key, arr)
    }
    fribbCache = { byTmdb, ts: Date.now() }
    return byTmdb
  } catch {
    if (fribbCache) return fribbCache.byTmdb   // keep stale on fetch failure
    return new Map()
  }
}

// TMDB (id + type + season) → AniList id. TMDB groups seasons under one tv id while AniList splits
// per season/cour, so we index the ordered candidate list by season number.
export async function tmdbToAnilist(tmdb: string, type: string, season = 1): Promise<number | null> {
  const rawId = String(tmdb).replace(/^(tv_|movie_)/, '')
  if (!rawId) return null
  const map = await loadFribb()
  const cands = map.get(`${type === 'tv' ? 'tv' : 'movie'}:${rawId}`)
  if (!cands || !cands.length) return null
  return cands[Math.max(0, (Number(season) || 1) - 1)] ?? cands[0]
}

// ── Anivexa provider adapters — each /watch route returns a different shape ──
const PROVIDER_PRIORITY = ['anizone', 'anikoto', 'animegg', 'reanime', 'anineko', '2dhive']

function normalize(provider: string, raw: any): AnimeSource | null {
  if (!raw) return null
  const subsOf = (arr: any[]): SubTrack[] =>
    (arr || []).filter(s => s?.url).map(s => ({ url: s.url, label: s.label || s.lang || 'Subs', lang: s.srclang || s.lang || 'en' }))
  // anizone: { streams:[{url,type:'hls',server,subtitles:[...]}] }
  // anikoto: { ssub:{streams:[{url,referer,server}]}, sdub?:{...} }
  // reanime: { stream_url, server, subtitles? }
  const s =
    raw.streams?.[0] ||
    raw.ssub?.streams?.[0] || raw.sdub?.streams?.[0] ||
    (raw.stream_url ? { url: raw.stream_url, server: raw.server } : null)
  if (!s?.url || !/\.(m3u8|mp4)/i.test(s.url)) return null
  const subs = subsOf(s.subtitles || raw.subtitles || raw.ssub?.subtitles || [])
  return {
    server: 'Sakura',
    lang: `Anime · ${s.server || provider}`,
    url: s.url,
    referer: s.referer || raw.referer || '',
    type: /\.mp4/i.test(s.url) ? 'mp4' : 'hls',
    subtitles: subs.length ? subs : undefined,
  }
}

// Returns anime HLS sources (multi-provider fallback) for a TMDB-keyed title, or [] if unavailable.
export async function getAnimeSources(type: string, season: string, episode: string, tmdb: string): Promise<AnimeSource[]> {
  if (!ANIME_API_URL) return []
  try {
    const anilist = await tmdbToAnilist(tmdb, type, Number(season) || 1)
    if (!anilist) return []                                   // not a known anime → skip
    const ep = type === 'tv' ? (Number(episode) || 1) : 1

    // Resolve providers in PARALLEL, each via its OWN per-provider episodes route
    // (/episodes/<provider>/<anilist>). Anivexa runs on Cloudflare Workers where a single request has
    // a ~50-subrequest budget — the all-providers /episodes/<anilist> aggregation blows past that and
    // returns half-empty. Querying one provider per request keeps each call well under the limit (each
    // is a separate Worker invocation with its own budget) and reliably returns full episode lists.
    const results = await Promise.all(PROVIDER_PRIORITY.map(async (p): Promise<AnimeSource | null> => {
      try {
        const er = await fetch(`${ANIME_API_URL}/episodes/${p}/${anilist}`, { signal: AbortSignal.timeout(20_000) })
        if (!er.ok) return null
        const eps: any = await er.json().catch(() => null)
        const arr: any[] = eps?.[p]?.episodes?.sub || eps?.[p]?.episodes?.dub || []
        const epObj = arr.find(e => e.number === ep) || (ep === 1 ? arr[0] : null)
        if (!epObj?.id) return null
        const wr = await fetch(`${ANIME_API_URL}/${epObj.id}`, { signal: AbortSignal.timeout(20_000) })
        if (!wr.ok) return null
        return normalize(p, await wr.json().catch(() => null))
      } catch { return null }
    }))
    const out: AnimeSource[] = []
    for (const src of results) if (src && !out.some(o => o.url === src.url)) { out.push(src); if (out.length >= 3) break }
    return out
  } catch { return [] }
}
