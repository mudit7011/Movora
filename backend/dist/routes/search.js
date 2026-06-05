"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchRouter = void 0;
const express_1 = require("express");
const Movie_1 = require("../models/Movie");
const tmdb_1 = require("../utils/tmdb");
const boundedCache_1 = require("../utils/boundedCache");
const router = (0, express_1.Router)();
exports.searchRouter = router;
const IMG_FACE = 'https://image.tmdb.org/t/p/w185';
// People search → their filmography that we actually have in the DB.
// No importing; only surfaces content already stored.
const cache = new Map();
const TTL = 6 * 60 * 60 * 1000; // 6 hours
const CACHE_MAX = 300;
router.get('/actor', async (req, res) => {
    try {
        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        if (q.length < 2) {
            res.json({ person: null, results: [] });
            return;
        }
        const hit = cache.get(q.toLowerCase());
        if (hit && Date.now() - hit.ts < TTL) {
            res.json(hit.data);
            return;
        }
        // 1. Resolve the person (TMDB ranks by popularity, tolerates partial/misspelled names)
        const search = await (0, tmdb_1.tmdbFetch)(`/search/person?query=${encodeURIComponent(q)}&language=en-US&page=1`);
        const person = (search.results || [])[0];
        if (!person) {
            res.json({ person: null, results: [] });
            return;
        }
        // 2. Their combined movie + TV credits
        const credits = await (0, tmdb_1.tmdbFetch)(`/person/${person.id}/combined_credits?language=en-US`);
        const cast = (credits.cast || [])
            .filter((c) => c.media_type === 'movie' || c.media_type === 'tv')
            .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        // 3. Cross-reference our DB (movies = bare id, tv = tv_<id>), preserving popularity order
        const ids = cast.map(c => (c.media_type === 'tv' ? `tv_${c.id}` : String(c.id)));
        const docs = await Movie_1.Movie.find({ tmdbId: { $in: ids }, posterUrl: { $ne: '' } }).select('-sources').lean();
        const byId = new Map(docs.map((d) => [String(d.tmdbId), d]));
        const seen = new Set();
        const results = [];
        for (const c of cast) {
            const tmdbId = c.media_type === 'tv' ? `tv_${c.id}` : String(c.id);
            const doc = byId.get(tmdbId);
            if (!doc)
                continue;
            const key = String(c.id);
            if (seen.has(key))
                continue;
            seen.add(key);
            results.push(doc);
            if (results.length >= 40)
                break;
        }
        const data = {
            person: {
                id: person.id,
                name: person.name,
                photo: person.profile_path ? `${IMG_FACE}${person.profile_path}` : null,
            },
            results,
        };
        (0, boundedCache_1.cacheSet)(cache, q.toLowerCase(), { data, ts: Date.now() }, CACHE_MAX);
        res.json(data);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
