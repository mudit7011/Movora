"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Scrapes the vidsrc.to movie catalog, enriches each entry with TMDB + OMDB
 * metadata, then upserts everything into MongoDB with multiple embed sources.
 *
 * Run: npm run scrape  (from backend/)
 *
 * vidsrc.to catalog API:
 *   GET https://vidsrc.to/vapi/movie/new?page=N
 *   { status: 200, result: { items: [{ tmdb_id, imdb_id, title }], pages: N } }
 */
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
// ─── Constants ────────────────────────────────────────────────────────────────
const TMDB_BEARER = process.env.TMDB_BEARER;
const OMDB_KEY = process.env.OMDB_API_KEY ?? ''; // optional fallback
const TMDB_BASE = 'https://api.themoviedb.org/3';
const OMDB_BASE = 'https://www.omdbapi.com';
const IMG_W = 'https://image.tmdb.org/t/p/w500';
const IMG_O = 'https://image.tmdb.org/t/p/original';
const IMG_FACE = 'https://image.tmdb.org/t/p/w185';
// Embed servers — ordered by reliability
const EMBED_SERVERS = [
    (id) => ({ name: 'Server 1', url: `https://embed.su/embed/movie/${id}`, type: 'iframe', quality: 'HD' }),
    (id) => ({ name: 'Server 2', url: `https://player.videasy.net/movie/${id}`, type: 'iframe', quality: 'HD' }),
    (id) => ({ name: 'Server 3', url: `https://vidsrc.cc/v2/embed/movie/${id}`, type: 'iframe', quality: 'HD' }),
];
const LANG_MAP = {
    hi: 'Hindi', en: 'English', ta: 'Tamil', te: 'Telugu',
    ml: 'Malayalam', bn: 'Bengali', mr: 'Marathi', pa: 'Punjabi',
    ko: 'Korean', ja: 'Japanese', fr: 'French', es: 'Spanish',
    zh: 'Chinese', de: 'German', it: 'Italian',
};
// ─── Helpers ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function get(url, headers = {}) {
    const res = await fetch(url, { headers });
    if (!res.ok)
        throw new Error(`HTTP ${res.status}: ${url}`);
    return res.json();
}
async function tmdb(endpoint) {
    return get(`${TMDB_BASE}${endpoint}`, {
        Authorization: `Bearer ${TMDB_BEARER}`,
        Accept: 'application/json',
    });
}
function slugify(title, year) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + year;
}
function bar(done, total, width = 30) {
    const pct = done / total;
    const filled = Math.round(pct * width);
    return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${done}/${total}`;
}
// Use TMDB directly — no scraping, never blocked
async function collectCatalog(maxPages = 0) {
    const pages = maxPages > 0 ? maxPages : 3;
    console.log(`Fetching TMDB movie catalog (${pages} pages each)...`);
    const seen = new Set();
    const all = [];
    const today = new Date().toISOString().split('T')[0];
    const endpoints = [
        `/movie/now_playing?language=en-US`,
        `/discover/movie?sort_by=release_date.desc&with_original_language=hi&primary_release_date.gte=2025-01-01&primary_release_date.lte=${today}&vote_count.gte=10`,
        `/discover/movie?sort_by=release_date.desc&with_original_language=en&primary_release_date.gte=2025-01-01&primary_release_date.lte=${today}&vote_count.gte=10`,
        `/movie/popular?language=en-US`,
    ];
    for (const ep of endpoints) {
        for (let p = 1; p <= pages; p++) {
            try {
                const sep = ep.includes('?') ? '&' : '?';
                const data = await tmdb(`${ep}${sep}page=${p}`);
                for (const m of (data.results ?? [])) {
                    if (m.id && !seen.has(m.id)) {
                        seen.add(m.id);
                        all.push({ tmdb_id: String(m.id), title: m.title || m.original_title });
                    }
                }
                await sleep(100);
            } catch (e) { /* skip page */ }
        }
    }
    console.log(`  Total catalog entries: ${all.length}`);
    return all;
}
// ─── TMDB enrichment ─────────────────────────────────────────────────────────
async function enrichFromTmdb(tmdbId) {
    const [detail, credits, videos] = await Promise.all([
        tmdb(`/movie/${tmdbId}?language=en-US`),
        tmdb(`/movie/${tmdbId}/credits?language=en-US`),
        tmdb(`/movie/${tmdbId}/videos?language=en-US`),
    ]);
    const year = detail.release_date ? parseInt(detail.release_date.split('-')[0]) : 0;
    const title = detail.title || detail.original_title || '';
    if (!title || !year)
        return null;
    if (!detail.vote_count || detail.vote_count < 10)
        return null;
    if (detail.release_date && new Date(detail.release_date) > new Date())
        return null;
    const trailer = (videos.results ?? []).find(v => v.site === 'YouTube' && v.type === 'Trailer')?.key;
    const cast = (credits.cast ?? []).slice(0, 15).map(c => ({
        name: c.name,
        character: c.character ?? '',
        ...(c.profile_path ? { photo: `${IMG_FACE}${c.profile_path}` } : {}),
    }));
    const originalLang = detail.original_language ?? 'en';
    const langLabel = LANG_MAP[originalLang] ?? originalLang.toUpperCase();
    const genres = (detail.genres ?? []).map((g) => g.name);
    return {
        title,
        year,
        slug: slugify(title, year),
        langLabel,
        genres,
        rating: Math.round((detail.vote_average ?? 0) * 10) / 10,
        runtime: detail.runtime ?? 0,
        synopsis: detail.overview ?? '',
        posterUrl: detail.poster_path ? `${IMG_W}${detail.poster_path}` : '',
        backdropUrl: detail.backdrop_path ? `${IMG_O}${detail.backdrop_path}` : '',
        trailerKey: trailer ?? '',
        cast,
    };
}
// ─── OMDB fallback (for movies not found on TMDB) ─────────────────────────────
async function enrichFromOmdb(imdbId, title) {
    if (!OMDB_KEY && !imdbId)
        return null;
    try {
        const params = imdbId
            ? `i=${imdbId}&apikey=${OMDB_KEY}`
            : `t=${encodeURIComponent(title)}&apikey=${OMDB_KEY}`;
        const d = await get(`${OMDB_BASE}/?${params}&plot=full`);
        if (d.Response !== 'True')
            return null;
        const year = parseInt(d.Year) || 0;
        const cleanTitle = d.Title || title;
        const rating = parseFloat(d.imdbRating) || 0;
        const runtime = parseInt(d.Runtime) || 0;
        const genres = (d.Genre ?? '').split(', ').filter(Boolean);
        return {
            title: cleanTitle,
            year,
            slug: slugify(cleanTitle, year),
            langLabel: 'English',
            genres,
            rating,
            runtime,
            synopsis: d.Plot ?? '',
            posterUrl: d.Poster && d.Poster !== 'N/A' ? d.Poster : '',
            backdropUrl: '',
            trailerKey: '',
            cast: [],
        };
    }
    catch {
        return null;
    }
}
// ─── Main upsert ─────────────────────────────────────────────────────────────
async function processMovie(item, col) {
    try {
        const tmdbId = item.tmdb_id;
        const imdbId = item.imdb_id ?? '';
        // Check if already in DB and was recently enriched (skip re-enrichment if < 7 days old)
        if (tmdbId) {
            const existing = await col.findOne({ tmdbId });
            if (existing?.updatedAt && (Date.now() - new Date(existing.updatedAt).getTime()) < 7 * 86400000) {
                // Still add any missing sources
                const existingSources = (existing.sources ?? []).map((s) => s.url);
                const newSources = EMBED_SERVERS
                    .map(fn => fn(tmdbId))
                    .filter(s => !existingSources.includes(s.url))
                    .map(s => ({ ...s, isWorking: true }));
                if (newSources.length > 0) {
                    await col.updateOne({ tmdbId }, { $push: { sources: { $each: newSources } } });
                }
                return 'skipped';
            }
        }
        // Enrich
        let meta = tmdbId ? await enrichFromTmdb(tmdbId).catch(() => null) : null;
        if (!meta && OMDB_KEY) {
            meta = await enrichFromOmdb(imdbId, item.title).catch(() => null);
        }
        if (!meta)
            return 'skipped';
        const id = tmdbId ?? imdbId;
        const sources = EMBED_SERVERS.map(fn => ({ ...fn(id), isWorking: true }));
        const doc = {
            ...(tmdbId ? { tmdbId } : {}),
            ...(imdbId ? { imdbId } : {}),
            title: meta.title,
            slug: meta.slug,
            type: 'movie',
            language: [meta.langLabel],
            genres: meta.genres,
            releaseYear: meta.year,
            rating: meta.rating,
            runtime: meta.runtime,
            synopsis: meta.synopsis,
            posterUrl: meta.posterUrl,
            backdropUrl: meta.backdropUrl,
            ...(meta.trailerKey ? { trailerKey: meta.trailerKey } : {}),
            cast: meta.cast,
            sources,
            streamVerified: true,
            scrapedFrom: 'vidsrc-catalog',
            updatedAt: new Date(),
        };
        await col.updateOne({ $or: [{ tmdbId: doc.tmdbId }, { slug: doc.slug }].filter(x => Object.values(x)[0]) }, { $set: doc, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
        return 'saved';
    }
    catch {
        return 'error';
    }
}
// ─── Entry point ──────────────────────────────────────────────────────────────
async function main() {
    if (!TMDB_BEARER) {
        console.error('TMDB_BEARER not set in .env');
        process.exit(1);
    }
    if (!OMDB_KEY)
        console.warn('⚠  OMDB_API_KEY not set — OMDB fallback disabled');
    await mongoose_1.default.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');
    const col = mongoose_1.default.connection.collection('movies');
    // Collect catalog. Pass a number to cap pages (each page ≈ 20 movies).
    // Leave 0 to fetch ALL pages (can be 500+ = 10k+ movies).
    const MAX_PAGES = parseInt(process.env.SCRAPE_MAX_PAGES ?? '0');
    const catalog = await collectCatalog(MAX_PAGES);
    // Deduplicate by tmdb_id
    const seen = new Set();
    const unique = catalog.filter(item => {
        const key = item.tmdb_id ?? item.title;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
    console.log(`\nProcessing ${unique.length} unique movies...\n`);
    let saved = 0, skipped = 0, errors = 0;
    const startTime = Date.now();
    for (let i = 0; i < unique.length; i++) {
        const item = unique[i];
        const result = await processMovie(item, col);
        if (result === 'saved')
            saved++;
        else if (result === 'skipped')
            skipped++;
        else
            errors++;
        // Throttle TMDB API (40 req/10s limit)
        await sleep(260);
        if ((i + 1) % 10 === 0 || i === unique.length - 1) {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            const eta = Math.round(((unique.length - i - 1) * 260) / 1000);
            process.stdout.write(`\r${bar(i + 1, unique.length)} | saved:${saved} skip:${skipped} err:${errors} | ETA:${eta}s  `);
        }
    }
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n\n✅ Done in ${elapsed}s — ${saved} saved, ${skipped} skipped, ${errors} errors`);
    await mongoose_1.default.disconnect();
}
main().catch(err => { console.error(err); process.exit(1); });
