"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Fetches TV shows from TMDB and seeds them into MongoDB as type:'tvshow'.
 * Run: npx ts-node scripts/fetch-tmdb-shows.ts
 */
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const https_1 = __importDefault(require("https"));
const zlib_1 = __importDefault(require("zlib"));
const dns_1 = require("dns");
// Try multiple paths to find .env regardless of CWD
const envPaths = [
    path_1.default.resolve(process.cwd(), '.env'),
    path_1.default.resolve(process.cwd(), '../.env'),
    path_1.default.resolve(__dirname, '../../.env'),
    path_1.default.resolve(__dirname, '../../../.env'),
];
for (const p of envPaths) {
    const result = dotenv_1.default.config({ path: p });
    if (!result.error && process.env.TMDB_BEARER)
        break;
}
const BEARER = process.env.TMDB_BEARER;
const OMDB_KEY = process.env.OMDB_API_KEY ?? '';
const BASE = 'https://api.themoviedb.org/3';
const OMDB_BASE = 'https://www.omdbapi.com';
const IMG_W = 'https://image.tmdb.org/t/p/w500';
const IMG_O = 'https://image.tmdb.org/t/p/original';
const IMG_FACE = 'https://image.tmdb.org/t/p/w185';
const LANG_LABEL = {
    hi: 'Hindi',
    en: 'English',
};
const EXCLUDED_GENRES = ['Music', 'Talk', 'News', 'Reality', 'Soap'];
function slugify(title, year) {
    return 'show-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + year;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
// Resolve TMDB hostname via Google DNS to bypass ISP DNS issues
let tmdbIP = null;
async function getTmdbIP() {
    if (tmdbIP)
        return tmdbIP;
    return new Promise((resolve) => {
        const resolver = new dns_1.Resolver();
        resolver.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
        resolver.resolve4('api.themoviedb.org', (err, addresses) => {
            if (!err && addresses.length > 0) {
                tmdbIP = addresses[0];
                console.log(`  Resolved api.themoviedb.org → ${tmdbIP} (via Google DNS)`);
                resolve(addresses[0]);
            }
            else {
                resolve('api.themoviedb.org'); // fallback to hostname
            }
        });
    });
}
function httpsRequest(ip, path, headers) {
    return new Promise((resolve, reject) => {
        const req = https_1.default.request({
            host: ip,
            port: 443,
            path,
            method: 'GET',
            servername: 'api.themoviedb.org',
            headers: { ...headers, Host: 'api.themoviedb.org' },
            timeout: 30000,
        }, (res) => {
            if (res.statusCode && res.statusCode >= 400) {
                reject(new Error(`HTTP ${res.statusCode}`));
                res.resume();
                return;
            }
            const enc = res.headers['content-encoding'];
            let stream = res;
            if (enc === 'gzip')
                stream = res.pipe(zlib_1.default.createGunzip());
            else if (enc === 'deflate')
                stream = res.pipe(zlib_1.default.createInflate());
            else if (enc === 'br')
                stream = res.pipe(zlib_1.default.createBrotliDecompress());
            const chunks = [];
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => {
                try {
                    resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
                }
                catch (e) {
                    reject(e);
                }
            });
            stream.on('error', reject);
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
        req.end();
    });
}
async function tmdb(endpoint) {
    const ip = await getTmdbIP();
    return httpsRequest(ip, `/3${endpoint}`, {
        Authorization: `Bearer ${BEARER}`,
        Accept: 'application/json',
    });
}
async function omdbRating(imdbId) {
    if (!OMDB_KEY || !imdbId)
        return null;
    try {
        const res = await fetch(`${OMDB_BASE}/?i=${imdbId}&apikey=${OMDB_KEY}`);
        const data = await res.json();
        if (data.imdbRating && data.imdbRating !== 'N/A') {
            return Math.round(parseFloat(data.imdbRating) * 10) / 10;
        }
    }
    catch { /* skip */ }
    return null;
}
async function collectShows(lang, pages) {
    const map = new Map();
    const endpoints = [
        `/tv/popular?language=en-US&with_original_language=${lang}`,
        `/tv/top_rated?language=en-US&with_original_language=${lang}`,
        `/discover/tv?language=en-US&with_original_language=${lang}&sort_by=vote_count.desc`,
        `/discover/tv?language=en-US&with_original_language=${lang}&sort_by=popularity.desc`,
    ];
    for (const ep of endpoints) {
        for (let p = 1; p <= pages; p++) {
            try {
                const sep = ep.includes('?') ? '&' : '?';
                const data = await tmdb(`${ep}${sep}page=${p}`);
                const results = data.results || [];
                results.forEach((s) => { if (s.id)
                    map.set(s.id, s); });
                process.stdout.write(`\r  ${lang}: ${map.size} unique (p${p}/${pages})   `);
                await sleep(80);
            }
            catch {
                await sleep(1000);
            }
        }
    }
    console.log();
    return map;
}
async function enrichAndUpsert(showId, basicInfo, col) {
    try {
        const [detail, credits, videos] = await Promise.all([
            tmdb(`/tv/${showId}?language=en-US&append_to_response=external_ids`),
            tmdb(`/tv/${showId}/credits?language=en-US`),
            tmdb(`/tv/${showId}/videos?language=en-US`),
        ]);
        await sleep(120);
        const name = detail.name || basicInfo.name;
        if (!name)
            return false;
        const firstAirYear = (detail.first_air_date || basicInfo.first_air_date || '')
            ? parseInt((detail.first_air_date || basicInfo.first_air_date).split('-')[0])
            : 0;
        if (!firstAirYear)
            return false;
        // Skip shows with excluded genres
        const genres = (detail.genres || []).map((g) => g.name);
        if (genres.some((g) => EXCLUDED_GENRES.includes(g)))
            return false;
        // Skip shows with no poster or backdrop
        if (!basicInfo.poster_path && !detail.poster_path)
            return false;
        if (!basicInfo.backdrop_path && !detail.backdrop_path)
            return false;
        const trailer = (videos.results || []).find((v) => v.site === 'YouTube' && v.type === 'Trailer')?.key;
        const cast = (credits.cast || []).slice(0, 15).map((c) => ({
            name: c.name,
            character: c.character || '',
            ...(c.profile_path ? { photo: `${IMG_FACE}${c.profile_path}` } : {}),
        }));
        const originalLang = detail.original_language || 'en';
        const langLabel = LANG_LABEL[originalLang] || originalLang.toUpperCase();
        // Season data (skip season 0 = specials)
        const seasonData = (detail.seasons || [])
            .filter((s) => s.season_number > 0 && s.episode_count > 0)
            .map((s) => ({
            seasonNumber: s.season_number,
            episodeCount: s.episode_count,
            name: s.name || `Season ${s.season_number}`,
        }));
        const totalSeasons = seasonData.length;
        const totalEpisodes = seasonData.reduce((sum, s) => sum + s.episodeCount, 0);
        // OMDB rating
        const imdbId = detail.external_ids?.imdb_id;
        const imdbRating = await omdbRating(imdbId);
        const rating = imdbRating ?? (Math.round((detail.vote_average || 0) * 10) / 10);
        // Status mapping
        const statusMap = {
            'Returning Series': 'Returning Series',
            'Ended': 'Ended',
            'Canceled': 'Canceled',
            'In Production': 'In Production',
        };
        const status = statusMap[detail.status] ?? detail.status ?? '';
        const doc = {
            tmdbId: `tv_${showId}`,
            title: name,
            slug: slugify(name, firstAirYear),
            type: 'tvshow',
            language: [langLabel],
            genres,
            releaseYear: firstAirYear,
            rating,
            runtime: detail.episode_run_time?.[0] || 45,
            synopsis: detail.overview || basicInfo.overview || '',
            posterUrl: (basicInfo.poster_path || detail.poster_path) ? `${IMG_W}${basicInfo.poster_path || detail.poster_path}` : '',
            backdropUrl: (basicInfo.backdrop_path || detail.backdrop_path) ? `${IMG_O}${basicInfo.backdrop_path || detail.backdrop_path}` : '',
            ...(trailer ? { trailerKey: trailer } : {}),
            cast,
            sources: [
                { serverName: 'Server 1', url: `https://player.videasy.net/tv/${showId}/1/1`, type: 'iframe', quality: 'HD', isWorking: true },
                { serverName: 'Server 2', url: `https://www.2embed.cc/embedtv/${showId}&s=1&e=1`, type: 'iframe', quality: 'HD', isWorking: true },
                { serverName: 'Server 3', url: `https://vidsrc.icu/embed/tv/${showId}/1/1`, type: 'iframe', quality: 'HD', isWorking: true },
                { serverName: 'Server 4', url: `https://embed.su/embed/tv/${showId}/1/1`, type: 'iframe', quality: 'HD', isWorking: true },
                { serverName: 'Server 5', url: `https://vidsrc.cc/v2/embed/tv/${showId}/1/1`, type: 'iframe', quality: 'HD', isWorking: true },
            ],
            seasons: totalSeasons,
            totalEpisodes,
            status,
            seasonData,
            scrapedFrom: 'tmdb-tv-fetch',
            updatedAt: new Date(),
        };
        await col.updateOne({ tmdbId: doc.tmdbId }, { $set: doc, $setOnInsert: { createdAt: new Date(), streamVerified: true } }, { upsert: true });
        return true;
    }
    catch {
        return false;
    }
}
async function main() {
    if (!BEARER) {
        console.error('TMDB_BEARER not set in .env');
        console.error('Tried paths:', envPaths);
        process.exit(1);
    }
    console.log('TMDB bearer loaded ✓');
    // Quick API test
    try {
        const test = await tmdb('/tv/popular?language=en-US&page=1');
        console.log(`TMDB API OK — got ${test.results?.length ?? 0} results on test call`);
    }
    catch (e) {
        console.error('TMDB API test FAILED:', e);
        process.exit(1);
    }
    await mongoose_1.default.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');
    const col = mongoose_1.default.connection.collection('movies');
    let grandTotal = 0;
    // [lang_code, pages_per_endpoint]
    const targets = [
        ['hi', 10], // Hindi: 4 endpoints × 10 pages
        ['en', 10], // English: 4 endpoints × 10 pages
    ];
    for (const [lang] of targets) {
        const label = LANG_LABEL[lang] || lang;
        console.log(`\n── ${label} TV Shows ──`);
        const showMap = await collectShows(lang, targets.find(t => t[0] === lang)[1]);
        const shows = Array.from(showMap.entries());
        console.log(`  Enriching ${shows.length} shows from TMDB...`);
        let done = 0, saved = 0;
        for (const [id, basic] of shows) {
            done++;
            const title = ((basic.name || '').substring(0, 38)).padEnd(38);
            process.stdout.write(`\r  [${done}/${shows.length}] ${title} `);
            const ok = await enrichAndUpsert(id, basic, col);
            if (ok) {
                saved++;
                grandTotal++;
            }
        }
        console.log(`\n  ✓ ${saved}/${shows.length} saved`);
    }
    console.log(`\n✅ Complete! ${grandTotal} TV shows upserted into MongoDB.`);
    await mongoose_1.default.disconnect();
}
main().catch(err => { console.error(err); process.exit(1); });
