"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminScrapeRouter = void 0;
const express_1 = require("express");
const ScrapeJob_1 = require("../../models/ScrapeJob");
const tmdb_1 = require("../../utils/tmdb");
const importer_1 = require("../../utils/importer");
const authenticate_1 = require("../../middleware/authenticate");
const router = (0, express_1.Router)();
exports.adminScrapeRouter = router;
router.use(authenticate_1.authenticate);
const FETCH_ACTIONS = {
    'trending-movies': { label: 'Trending Movies (Week)', endpoint: '/trending/movie/week?language=en-US', mediaType: 'movie' },
    'popular-movies': { label: 'Popular Movies', endpoint: '/movie/popular?language=en-US&page=1', mediaType: 'movie' },
    'top-rated-movies': { label: 'Top Rated Movies', endpoint: '/movie/top_rated?language=en-US&page=1', mediaType: 'movie' },
    'upcoming-movies': { label: 'Upcoming Movies', endpoint: '/movie/upcoming?language=en-US&page=1', mediaType: 'movie' },
    'now-playing': { label: 'Now Playing Movies', endpoint: '/movie/now_playing?language=en-US&page=1', mediaType: 'movie' },
    'trending-shows': { label: 'Trending Shows (Week)', endpoint: '/trending/tv/week?language=en-US', mediaType: 'tv' },
    'popular-shows': { label: 'Popular Shows', endpoint: '/tv/popular?language=en-US&page=1', mediaType: 'tv' },
    'top-rated-shows': { label: 'Top Rated Shows', endpoint: '/tv/top_rated?language=en-US&page=1', mediaType: 'tv' },
    'airing-today': { label: 'Airing Today Shows', endpoint: '/tv/airing_today?language=en-US&page=1', mediaType: 'tv' },
    'hindi-movies': { label: 'Hindi Movies', endpoint: '/discover/movie?with_original_language=hi&sort_by=popularity.desc&page=1', mediaType: 'movie' },
    'hindi-shows': { label: 'Hindi OTT Series', endpoint: '/discover/tv?with_original_language=hi&without_genres=10766,10763,10767&vote_count.gte=200&vote_average.gte=7&sort_by=popularity.desc&page=1', mediaType: 'tv' },
    'korean-shows': { label: 'Korean Shows', endpoint: '/discover/tv?with_original_language=ko&sort_by=popularity.desc&page=1', mediaType: 'tv' },
    'korean-dramas': { label: 'Korean Dramas', endpoint: '/discover/tv?with_original_language=ko&with_genres=18&sort_by=popularity.desc&page=1', mediaType: 'tv' },
    'japanese-shows': { label: 'Japanese Shows', endpoint: '/discover/tv?with_original_language=ja&sort_by=popularity.desc&page=1', mediaType: 'tv' },
    'japanese-anime': { label: 'Japanese Anime', endpoint: '/discover/tv?with_original_language=ja&with_genres=16&sort_by=popularity.desc&page=1', mediaType: 'tv' },
    'korean-movies': { label: 'Korean Movies', endpoint: '/discover/movie?with_original_language=ko&sort_by=popularity.desc&page=1', mediaType: 'movie' },
    'japanese-movies': { label: 'Japanese Movies', endpoint: '/discover/movie?with_original_language=ja&sort_by=popularity.desc&page=1', mediaType: 'movie' },
};
// Run a fetch action — fetches multiple TMDB pages (default 5, max 20)
router.post('/fetch/:action', async (req, res) => {
    const action = FETCH_ACTIONS[req.params.action];
    if (!action) {
        res.status(400).json({ error: 'Unknown action' });
        return;
    }
    const pageCount = Math.min(Math.max(Number(req.query.pages ?? 5), 1), 20);
    const job = await ScrapeJob_1.ScrapeJob.create({ site: req.params.action, label: action.label, status: 'running', startedAt: new Date() });
    try {
        let added = 0, skipped = 0, errors = 0;
        const addedTitles = [];
        for (let p = 1; p <= pageCount; p++) {
            const endpoint = action.endpoint.replace(/page=\d+/, `page=${p}`);
            const data = await (0, tmdb_1.tmdbFetch)(endpoint);
            const results = data.results || [];
            if (results.length === 0)
                break;
            for (const item of results) {
                const result = action.mediaType === 'movie' ? await (0, importer_1.importMovie)(item.id) : await (0, importer_1.importShow)(item.id);
                if (result.status === 'added') {
                    added++;
                    if (result.title)
                        addedTitles.push(result.title);
                }
                if (result.status === 'skipped')
                    skipped++;
                if (result.status === 'error')
                    errors++;
            }
        }
        await ScrapeJob_1.ScrapeJob.findByIdAndUpdate(job._id, {
            status: 'completed', added, skipped, addedTitles,
            scrapeErrors: errors > 0 ? [`${errors} items failed`] : [],
            completedAt: new Date(),
        });
        res.json({ jobId: job._id, label: action.label, added, skipped, errors, addedTitles });
    }
    catch (e) {
        await ScrapeJob_1.ScrapeJob.findByIdAndUpdate(job._id, {
            status: 'failed', scrapeErrors: [e.message], completedAt: new Date(),
        });
        res.status(500).json({ error: e.message });
    }
});
router.get('/actions', (_req, res) => {
    res.json(Object.entries(FETCH_ACTIONS).map(([key, v]) => ({ key, label: v.label, mediaType: v.mediaType })));
});
router.get('/jobs', async (_req, res) => {
    try {
        const jobs = await ScrapeJob_1.ScrapeJob.find().sort({ startedAt: -1 }).limit(30);
        res.json(jobs);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// Legacy trigger (kept for compatibility)
router.post('/trigger', async (_req, res) => {
    res.status(400).json({ error: 'Use /fetch/:action instead', actions: Object.keys(FETCH_ACTIONS) });
});
