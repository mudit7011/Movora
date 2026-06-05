"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realtimeRouter = void 0;
exports.clearRealtimeCache = clearRealtimeCache;
const express_1 = require("express");
const Movie_1 = require("../models/Movie");
const tmdb_1 = require("../utils/tmdb");
const importer_1 = require("../utils/importer");
const boundedCache_1 = require("../utils/boundedCache");
const router = (0, express_1.Router)();
exports.realtimeRouter = router;
// In-memory cache: fresh for 1 hour, then TMDB is re-fetched
const cache = new Map();
const TTL = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_MAX = 400; // cap entries so the cache can't grow unbounded and OOM the process
const MOVIE_ENDPOINTS = {
    trending: '/trending/movie/week?language=en-US',
    popular: '/movie/popular?language=en-US',
    'top-rated': '/movie/top_rated?language=en-US',
    'now-playing': '/movie/now_playing?language=en-US',
    hindi: '/discover/movie?with_original_language=hi&sort_by=popularity.desc&language=en-US',
    korean: '/discover/movie?with_original_language=ko&sort_by=popularity.desc&language=en-US',
    japanese: '/discover/movie?with_original_language=ja&sort_by=popularity.desc&primary_release_date.gte=2001-01-01&language=en-US',
};
// 10766 = Soap, 10763 = News, 10767 = Talk Show — exclude all three
const NO_SERIALS = 'without_genres=10766,10763,10767&vote_count.gte=10&vote_average.gte=5';
const SHOW_ENDPOINTS = {
    trending: '/trending/tv/week?language=en-US',
    popular: `/tv/popular?language=en-US`,
    'top-rated': `/tv/top_rated?language=en-US`,
    'airing-today': `/tv/airing_today?language=en-US`,
    hindi: `/discover/tv?with_original_language=hi&sort_by=popularity.desc&${NO_SERIALS}&language=en-US`,
    korean: `/discover/tv?with_original_language=ko&sort_by=popularity.desc&${NO_SERIALS}&language=en-US`,
    japanese: `/discover/tv?with_original_language=ja&sort_by=popularity.desc&${NO_SERIALS}&language=en-US`,
};
function injectPage(endpoint, page) {
    if (endpoint.includes('page='))
        return endpoint.replace(/page=\d+/, `page=${page}`);
    return endpoint + `&page=${page}`;
}
async function getRealtime(cacheKey, tmdbEndpoint, mediaType, page = 1) {
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.ts < TTL)
        return { docs: hit.docs, totalPages: hit.totalPages ?? 1 };
    // 1. Fetch TMDB list (1 call)
    const data = await (0, tmdb_1.tmdbFetch)(injectPage(tmdbEndpoint, page));
    const results = data.results || [];
    const totalPages = Math.min(data.total_pages ?? 1, 10); // cap at 10 pages
    // 2. Batch check which IDs already exist in DB
    const tmdbIds = results.map(r => mediaType === 'movie' ? String(r.id) : `tv_${r.id}`);
    const existing = await Movie_1.Movie.find({ tmdbId: { $in: tmdbIds } }).select('-sources').lean();
    const byId = new Map(existing.map(m => [String(m.tmdbId), m]));
    // 3. Import missing items in batches of 5 (parallel within batch, sequential across)
    const missing = results.filter(r => !byId.has(mediaType === 'movie' ? String(r.id) : `tv_${r.id}`));
    for (let i = 0; i < missing.length; i += 5) {
        const batch = missing.slice(i, i + 5);
        await Promise.allSettled(batch.map(r => mediaType === 'movie' ? (0, importer_1.importMovie)(r.id) : (0, importer_1.importShow)(r.id)));
    }
    // 4. Re-fetch newly imported docs
    if (missing.length > 0) {
        const newIds = missing.map(r => mediaType === 'movie' ? String(r.id) : `tv_${r.id}`);
        const newDocs = await Movie_1.Movie.find({ tmdbId: { $in: newIds } }).select('-sources').lean();
        for (const d of newDocs)
            byId.set(String(d.tmdbId), d);
    }
    const EXCLUDED_GENRES = ['Music', 'Talk', 'News', 'Reality', 'Soap'];
    // 5. Return in TMDB rank order — filter serials, excluded genres, missing posters
    const docs = results
        .map(r => byId.get(mediaType === 'movie' ? String(r.id) : `tv_${r.id}`))
        .filter((d) => {
        if (!d || !d.posterUrl)
            return false;
        // Drop excluded genres
        if (d.genres?.some((g) => EXCLUDED_GENRES.includes(g)))
            return false;
        // Drop daily soaps: any season with >100 episodes
        if (d.seasonData?.some((s) => s.episodeCount > 100))
            return false;
        return true;
    });
    (0, boundedCache_1.cacheSet)(cache, cacheKey, { docs, ts: Date.now(), totalPages }, CACHE_MAX);
    return { docs, totalPages };
}
router.get('/movies/:category', async (req, res) => {
    const endpoint = MOVIE_ENDPOINTS[req.params.category];
    if (!endpoint) {
        res.status(400).json({ error: 'Unknown category' });
        return;
    }
    const page = Math.max(1, Number(req.query.page ?? 1));
    try {
        const { docs, totalPages } = await getRealtime(`m:${req.params.category}:${page}`, endpoint, 'movie', page);
        res.json({ results: docs, page, totalPages });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/shows/:category', async (req, res) => {
    const endpoint = SHOW_ENDPOINTS[req.params.category];
    if (!endpoint) {
        res.status(400).json({ error: 'Unknown category' });
        return;
    }
    const page = Math.max(1, Number(req.query.page ?? 1));
    try {
        const { docs, totalPages } = await getRealtime(`s:${req.params.category}:${page}`, endpoint, 'tv', page);
        res.json({ results: docs, page, totalPages });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
const PLATFORM_PROVIDERS = {
    netflix: { id: 8, region: 'US' },
    prime: { id: 9, region: 'US' },
    'apple-tv': { id: 350, region: 'US' },
    max: { id: 1899, region: 'US' },
    'disney-plus': { id: 337, region: 'US' },
    hulu: { id: 15, region: 'US' },
};
router.get('/providers', async (_req, res) => {
    try {
        const hit = cache.get('providers');
        if (hit && Date.now() - hit.ts < TTL) {
            res.json(hit.docs);
            return;
        }
        const data = await (0, tmdb_1.tmdbFetch)('/watch/providers/movie?watch_region=US&language=en-US');
        const wanted = new Set(Object.values(PLATFORM_PROVIDERS).map(p => p.id));
        const docs = (data.results || []).filter((p) => wanted.has(p.provider_id));
        (0, boundedCache_1.cacheSet)(cache, 'providers', { docs, ts: Date.now(), totalPages: 1 }, CACHE_MAX);
        res.json(docs);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/platform/:name/:type', async (req, res) => {
    const { name, type } = req.params;
    const platform = PLATFORM_PROVIDERS[name];
    if (!platform) {
        res.status(400).json({ error: 'Unknown platform' });
        return;
    }
    if (type !== 'movies' && type !== 'shows') {
        res.status(400).json({ error: 'Invalid type' });
        return;
    }
    const mediaType = type === 'shows' ? 'tv' : 'movie';
    const page = Math.max(1, Number(req.query.page ?? 1));
    const endpoint = `/discover/${mediaType}?with_watch_providers=${platform.id}&watch_region=${platform.region}&sort_by=popularity.desc&language=en-US`;
    try {
        const { docs, totalPages } = await getRealtime(`plat:${name}:${mediaType}:${page}`, endpoint, mediaType, page);
        res.json({ results: docs, page, totalPages });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
function clearRealtimeCache() {
    cache.clear();
}
