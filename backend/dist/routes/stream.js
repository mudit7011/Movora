"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamRouter = void 0;
const express_1 = require("express");
const streamvaultScraper_1 = require("../utils/streamvaultScraper");
exports.streamRouter = (0, express_1.Router)();
// DELETE /api/stream/cache — clear all cached stream URLs
exports.streamRouter.delete('/cache', (_req, res) => {
    (0, streamvaultScraper_1.clearStreamCache)();
    res.json({ ok: true, message: 'Stream cache cleared' });
});
// GET /api/stream?tmdbId=124364&type=tv&season=1&episode=1
// GET /api/stream?tmdbId=552&type=movie&refresh=1  (bypass cache)
exports.streamRouter.get('/', async (req, res) => {
    const { tmdbId, type, season, episode, refresh } = req.query;
    if (!tmdbId || !type || (type !== 'movie' && type !== 'tv')) {
        return res.status(400).json({ error: 'tmdbId and type (movie|tv) required' });
    }
    const s = season ? parseInt(season) : undefined;
    const e = episode ? parseInt(episode) : undefined;
    if (type === 'tv' && (!s || !e)) {
        return res.status(400).json({ error: 'season and episode required for tv' });
    }
    const force = refresh === '1';
    try {
        const sv = await (0, streamvaultScraper_1.scrapeStreamVault)(tmdbId, type, s, e, force);
        if (sv)
            return res.json(sv);
        return res.status(404).json({ error: 'Stream not found' });
    }
    catch (err) {
        console.error('[stream route]', err);
        res.status(500).json({ error: 'Scrape failed' });
    }
});
