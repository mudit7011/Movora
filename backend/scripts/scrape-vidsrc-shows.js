"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Scrapes the vidsrc.to TV shows catalog, enriches each entry with TMDB
 * metadata, then upserts into MongoDB.
 *
 * Run: npx ts-node scripts/scrape-vidsrc-shows.ts
 *
 * vidsrc.to catalog API:
 *   GET https://vidsrc.to/vapi/tv/new?page=N
 *   { status: 200, result: { items: [{ tmdb_id, imdb_id, title }], pages: N } }
 */
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const TMDB_BEARER = process.env.TMDB_BEARER;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_W = 'https://image.tmdb.org/t/p/w500';
const IMG_O = 'https://image.tmdb.org/t/p/original';
const IMG_FACE = 'https://image.tmdb.org/t/p/w185';
const EMBED_SERVERS = [
    (id) => ({ name: 'Server 1', url: `https://player.videasy.net/tv/${id}`, type: 'iframe', quality: 'HD' }),
    (id) => ({ name: 'Server 2', url: `https://www.2embed.cc/embedtv/${id}`, type: 'iframe', quality: 'HD' }),
    (id) => ({ name: 'Server 3', url: `https://vidsrc.icu/embed/tv/${id}`, type: 'iframe', quality: 'HD' }),
    (id) => ({ name: 'Server 4', url: `https://embed.su/embed/tv/${id}`, type: 'iframe', quality: 'HD' }),
    (id) => ({ name: 'Server 5', url: `https://vidsrc.cc/v2/embed/tv/${id}`, type: 'iframe', quality: 'HD' }),
];
const LANG_MAP = {
    hi: 'Hindi', en: 'English', ta: 'Tamil', te: 'Telugu',
    ml: 'Malayalam', bn: 'Bengali', mr: 'Marathi', pa: 'Punjabi',
    ko: 'Korean', ja: 'Japanese', fr: 'French', es: 'Spanish',
    zh: 'Chinese', de: 'German', it: 'Italian',
};
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
async function fetchCatalogPage(page) {
    const data = await get(`https://vidsrc.to/vapi/tv/new?page=${page}`);
    return {
        items: data?.result?.items ?? [],
        pages: data?.result?.pages ?? 1,
    };
}
async function collectCatalog(maxPages = 0) {
    console.log('Fetching vidsrc.to TV catalog...');
    const first = await fetchCatalogPage(1);
    const total = maxPages > 0 ? Math.min(maxPages, first.pages) : first.pages;
    const all = [...first.items];
    for (let p = 2; p <= total; p++) {
        try {
            const page = await fetchCatalogPage(p);
            all.push(...page.items);
        }
        catch {
            await sleep(2000);
            try {
                const page = await fetchCatalogPage(p);
                all.push(...page.items);
            }
            catch { /* skip */ }
        }
        await sleep(200);
        process.stdout.write(`\r  Page ${p}/${total} — ${all.length} shows so far`);
    }
    console.log(`\n  Total catalog entries: ${all.length}`);
    return all;
}
async function enrichFromTmdb(tmdbId) {
    const [detail, credits, videos] = await Promise.all([
        tmdb(`/tv/${tmdbId}?language=en-US`),
        tmdb(`/tv/${tmdbId}/credits?language=en-US`),
        tmdb(`/tv/${tmdbId}/videos?language=en-US`),
    ]);
    const year = detail.first_air_date ? parseInt(detail.first_air_date.split('-')[0]) : 0;
    const title = detail.name || detail.original_name || '';
    if (!title || !year)
        return null;
    const trailer = (videos.results ?? []).find(v => v.site === 'YouTube' && v.type === 'Trailer')?.key;
    const cast = (credits.cast ?? []).slice(0, 15).map((c) => ({
        name: c.name,
        character: c.character ?? '',
        ...(c.profile_path ? { photo: `${IMG_FACE}${c.profile_path}` } : {}),
    }));
    const originalLang = detail.original_language ?? 'en';
    const langLabel = LANG_MAP[originalLang] ?? originalLang.toUpperCase();
    const genres = (detail.genres ?? []).map((g) => g.name);
    const runtime = (detail.episode_run_time ?? [])[0] ?? 45;
    const seasonData = (detail.seasons ?? [])
        .filter((s) => s.season_number > 0)
        .map((s) => ({ seasonNumber: s.season_number, episodeCount: s.episode_count, name: s.name }));
    return {
        title,
        year,
        slug: slugify(title, year),
        langLabel,
        genres,
        rating: Math.round((detail.vote_average ?? 0) * 10) / 10,
        runtime,
        synopsis: detail.overview ?? '',
        posterUrl: detail.poster_path ? `${IMG_W}${detail.poster_path}` : '',
        backdropUrl: detail.backdrop_path ? `${IMG_O}${detail.backdrop_path}` : '',
        trailerKey: trailer ?? '',
        cast,
        seasons: detail.number_of_seasons ?? 1,
        totalEpisodes: detail.number_of_episodes ?? 0,
        status: detail.status ?? '',
        seasonData,
    };
}
async function processShow(item, col) {
    try {
        const tmdbId = item.tmdb_id;
        if (!tmdbId)
            return 'error';
        const existing = await col.findOne({ tmdbId });
        if (existing?.updatedAt && (Date.now() - new Date(existing.updatedAt).getTime()) < 7 * 86400000) {
            const existingSources = (existing.sources ?? []).map((s) => s.url);
            const newSources = EMBED_SERVERS
                .map(fn => fn(tmdbId))
                .filter(s => !existingSources.includes(s.url))
                .map(s => ({ ...s, isWorking: true, lastChecked: new Date() }));
            if (newSources.length > 0) {
                await col.updateOne({ tmdbId }, { $push: { sources: { $each: newSources } } });
            }
            return 'skipped';
        }
        const meta = await enrichFromTmdb(tmdbId);
        if (!meta)
            return 'error';
        const sources = EMBED_SERVERS.map(fn => ({
            ...fn(tmdbId),
            isWorking: true,
            lastChecked: new Date(),
        }));
        const doc = {
            tmdbId,
            title: meta.title,
            slug: meta.slug,
            type: 'tvshow',
            language: [meta.langLabel],
            genres: meta.genres,
            releaseYear: meta.year,
            rating: meta.rating,
            runtime: meta.runtime,
            synopsis: meta.synopsis,
            posterUrl: meta.posterUrl,
            backdropUrl: meta.backdropUrl,
            trailerKey: meta.trailerKey,
            cast: meta.cast,
            sources,
            streamVerified: true,
            scrapedFrom: 'vidsrc-catalog',
            seasons: meta.seasons,
            totalEpisodes: meta.totalEpisodes,
            status: meta.status,
            seasonData: meta.seasonData,
            updatedAt: new Date(),
        };
        await col.updateOne({ tmdbId }, { $set: doc, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
        return 'saved';
    }
    catch (e) {
        process.stdout.write(`\n  ⚠ ${item.title}: ${e.message}\n`);
        return 'error';
    }
}
async function main() {
    if (!TMDB_BEARER) {
        console.error('TMDB_BEARER not set');
        process.exit(1);
    }
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI not set');
        process.exit(1);
    }
    await mongoose_1.default.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');
    const col = mongoose_1.default.connection.collection('movies');
    const MAX_PAGES = parseInt(process.env.SCRAPE_MAX_PAGES ?? '0');
    const catalog = await collectCatalog(MAX_PAGES);
    const seen = new Set();
    const unique = catalog.filter(c => {
        const key = c.tmdb_id ?? c.title;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
    console.log(`\nProcessing ${unique.length} unique shows...\n`);
    let saved = 0, skipped = 0, errors = 0;
    const startTime = Date.now();
    for (let i = 0; i < unique.length; i++) {
        const item = unique[i];
        const result = await processShow(item, col);
        if (result === 'saved')
            saved++;
        else if (result === 'skipped')
            skipped++;
        else
            errors++;
        await sleep(260);
        if ((i + 1) % 10 === 0 || i === unique.length - 1) {
            const eta = Math.round(((unique.length - i - 1) * 260) / 1000);
            process.stdout.write(`\r${bar(i + 1, unique.length)} | saved:${saved} skip:${skipped} err:${errors} | ETA:${eta}s  `);
        }
    }
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n\n✅ Done in ${elapsed}s — ${saved} saved, ${skipped} skipped, ${errors} errors`);
    await mongoose_1.default.disconnect();
}
main().catch(err => { console.error(err); process.exit(1); });
