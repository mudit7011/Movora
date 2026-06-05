"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.moviesRouter = void 0;
const express_1 = require("express");
const Movie_1 = require("../models/Movie");
const tmdb_1 = require("../utils/tmdb");
const fuse_js_1 = __importDefault(require("fuse.js"));
const router = (0, express_1.Router)();
exports.moviesRouter = router;
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
// Genres that are unusable on embed providers or undesirable on home page
const EXCLUDED_GENRES = ['Music', 'Talk', 'News', 'Reality', 'Soap', 'TV Movie'];
router.get('/', async (req, res) => {
    try {
        const { page = '1', limit = '20', genre, year, language, minRating, minRuntime, sort = 'recent' } = req.query;
        const filter = { type: 'movie' };
        if (genre && typeof genre === 'string')
            filter.genres = genre;
        if (year) {
            filter.releaseYear = Number(year);
        }
        else {
            filter.releaseYear = { $gte: 2000 };
        }
        if (language && typeof language === 'string') {
            filter.language = language;
        }
        // no default language filter — show all languages
        // Always cap at 9.5 to exclude concert films / data anomalies; optionally floor from param
        const ratingFilter = { $lte: 9.5 };
        if (minRating)
            ratingFilter.$gte = Number(minRating);
        filter.rating = ratingFilter;
        filter.runtime = minRuntime ? { $gte: Number(minRuntime) } : { $gte: 60 };
        filter.posterUrl = { $ne: '' };
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;
        // Cap the candidate pool — sorting the entire collection in memory exceeds
        // MongoDB's 100MB sort limit on large catalogs and crashes the request.
        const CANDIDATE_CAP = 1000;
        let allDocs;
        if (!sort || sort === 'recent') {
            allDocs = await Movie_1.Movie.aggregate([
                { $match: { ...filter, rating: { ...filter.rating, $gte: 5 } } },
                { $addFields: { _score: { $add: [{ $multiply: ['$rating', 1.5] }, { $multiply: [{ $subtract: ['$releaseYear', 2000] }, 0.3] }] } } },
                { $sort: { _score: -1 } },
                { $limit: CANDIDATE_CAP },
                { $project: { sources: 0, _score: 0 } },
            ]).option({ allowDiskUse: true });
        }
        else {
            const sortMap = {
                rating: { rating: -1 },
                year: { releaseYear: -1 },
            };
            const sortObj = sortMap[sort] ?? { releaseYear: -1 };
            allDocs = await Movie_1.Movie.find(filter).sort(sortObj).limit(CANDIDATE_CAP).select('-sources').lean();
        }
        // Dedup by normalized tmdbId (strip movie_ prefix)
        const seen = new Set();
        const deduped = allDocs.filter(doc => {
            const key = String(doc.tmdbId ?? '').replace(/^movie_/, '');
            if (!key || seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
        const total = deduped.length;
        const movies = deduped.slice(skip, skip + limitNum);
        res.json({ movies, total, page: pageNum, pages: Math.ceil(total / limitNum) });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/trending', async (_req, res) => {
    try {
        // Trending = proven hits from previous years (2020 to last year), sorted by rating
        const currentYear = new Date().getFullYear();
        const movies = await Movie_1.Movie.find({
            type: 'movie',
            streamVerified: { $ne: false },
            language: { $in: ['Hindi', 'English'] },
            releaseYear: { $gte: 2020, $lte: currentYear - 1 },
            rating: { $gte: 7, $lte: 9.5 },
            runtime: { $gte: 60 },
            genres: { $nin: EXCLUDED_GENRES },
            posterUrl: { $ne: '' },
            backdropUrl: { $ne: '' },
        })
            .sort({ rating: -1, releaseYear: -1 })
            .limit(30)
            .select('-sources');
        const seen = new Set();
        const unique = movies.filter(m => {
            const key = m.title.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        }).slice(0, 15);
        res.json(unique);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/latest', async (_req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        // Latest = 2026 releases, any rating ≥ 5, sorted by rating
        const movies = await Movie_1.Movie.find({
            type: 'movie',
            streamVerified: { $ne: false },
            language: { $in: ['Hindi', 'English'] },
            releaseYear: { $gte: currentYear },
            runtime: { $gte: 60 },
            rating: { $gte: 5, $lte: 9.5 },
            genres: { $nin: EXCLUDED_GENRES },
            posterUrl: { $ne: '' },
            backdropUrl: { $ne: '' },
        })
            .sort({ rating: -1, releaseYear: -1 })
            .limit(40)
            .select('-sources');
        const seen = new Set();
        const unique = movies.filter(m => {
            const key = m.title.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        }).slice(0, 20);
        res.json(unique);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/popular', async (_req, res) => {
    try {
        const movies = await Movie_1.Movie.find({
            type: 'movie',
            streamVerified: { $ne: false },
            language: { $in: ['Hindi', 'English', 'Korean', 'Japanese', 'Tamil', 'Telugu'] },
            releaseYear: { $gte: 2015 },
            rating: { $gte: 6.5, $lte: 9.5 },
            runtime: { $gte: 60 },
            genres: { $nin: EXCLUDED_GENRES },
            posterUrl: { $ne: '' },
            backdropUrl: { $ne: '' },
        }).sort({ rating: -1, releaseYear: -1 }).limit(60).select('-sources');
        const seen = new Set();
        const unique = movies.filter(m => {
            const key = m.title.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        }).slice(0, 20);
        res.json(unique);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/top-rated', async (_req, res) => {
    try {
        const movies = await Movie_1.Movie.find({
            type: 'movie',
            streamVerified: { $ne: false },
            releaseYear: { $gte: 2000 },
            rating: { $gte: 8.0, $lte: 9.5 },
            runtime: { $gte: 60 },
            genres: { $nin: EXCLUDED_GENRES },
            posterUrl: { $ne: '' },
            backdropUrl: { $ne: '' },
        }).sort({ rating: -1, releaseYear: -1 }).limit(60).select('-sources');
        const seen = new Set();
        const unique = movies.filter(m => {
            const key = m.title.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        }).slice(0, 20);
        res.json(unique);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/by-language/:lang', async (req, res) => {
    try {
        const raw = await Movie_1.Movie.find({
            type: 'movie',
            streamVerified: { $ne: false },
            language: req.params.lang,
            releaseYear: { $gte: 2000 },
            runtime: { $gte: 60 },
            rating: { $gte: 6, $lte: 9.5 },
            genres: { $nin: EXCLUDED_GENRES },
            posterUrl: { $ne: '' },
            backdropUrl: { $ne: '' },
        })
            .sort({ rating: -1, releaseYear: -1 })
            .limit(300)
            .select('-sources');
        const seen = new Set();
        const movies = raw.filter(m => {
            const key = `${m.title.toLowerCase().replace(/[^a-z0-9]/g, '')}_${m.releaseYear ?? ''}`;
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
        res.json(movies);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || typeof q !== 'string')
            return res.json([]);
        const raw = q.trim();
        const tokens = raw.split(/\s+/).filter(Boolean);
        const escapedFull = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Pull a broad candidate set: match any token in title or titleHindi
        const anyTokenFilter = tokens.map(t => {
            const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return { $or: [{ title: { $regex: esc, $options: 'i' } }, { titleHindi: { $regex: esc, $options: 'i' } }] };
        });
        // Prefix fallback using first 2 chars — brings abbreviation-style queries
        // like "avgrs" into the candidate pool so fuse can find "Avengers"
        const prefix2 = raw.slice(0, 2).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const orClauses = [
            { $and: anyTokenFilter },
            { title: { $regex: escapedFull, $options: 'i' } },
            { titleHindi: { $regex: escapedFull, $options: 'i' } },
            { synopsis: { $regex: escapedFull, $options: 'i' } },
        ];
        if (tokens.length === 1) {
            orClauses.push({ title: { $regex: `^${prefix2}`, $options: 'i' } });
        }
        const candidates = await Movie_1.Movie.find({
            type: 'movie',
            $or: orClauses,
        })
            .limit(150)
            .select('-sources')
            .lean();
        // Fuzzy-rank the candidates so typos and abbreviations still surface
        const fuse = new fuse_js_1.default(candidates, {
            keys: [
                { name: 'title', weight: 2 },
                { name: 'titleHindi', weight: 1.5 },
                { name: 'synopsis', weight: 0.5 },
            ],
            threshold: 0.6,
            includeScore: true,
            ignoreLocation: true,
            minMatchCharLength: 2,
        });
        const fuseResults = fuse.search(raw);
        // If fuse found matches, return those; otherwise fall back to candidates sorted by rating
        const ranked = fuseResults.length > 0
            ? fuseResults.map(r => r.item)
            : candidates.sort((a, b) => b.rating - a.rating);
        const seenKeys = new Set();
        const deduped = ranked.filter(item => {
            const key = String(item.tmdbId ?? '').replace(/^movie_/, '') || String(item._id);
            if (seenKeys.has(key))
                return false;
            seenKeys.add(key);
            return true;
        });
        res.json(deduped.slice(0, 20));
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
const relatedCache = new Map();
const RELATED_TTL = 6 * 60 * 60 * 1000; // 6 hours
router.get('/related/:slug', async (req, res) => {
    try {
        const cached = relatedCache.get(req.params.slug);
        if (cached && Date.now() - cached.ts < RELATED_TTL)
            return res.json(cached.data);
        const movie = await Movie_1.Movie.findOne({ slug: req.params.slug, type: 'movie' }).select('_id tmdbId genres language rating');
        if (!movie)
            return res.json({ similar: [], youMayLove: [] });
        const rawId = String(movie.tmdbId ?? '').replace(/^movie_/, '');
        const movieId = String(movie._id);
        // Pick up to 12 unique, poster-having docs; `seen` is shared so the two rows don't overlap.
        const pick = (docs, seen) => {
            const out = [];
            for (const d of docs) {
                const key = String(d?.tmdbId ?? '').replace(/^movie_/, '');
                if (!key || seen.has(key) || !d.posterUrl)
                    continue;
                seen.add(key);
                out.push(d);
                if (out.length >= 12)
                    break;
            }
            return out;
        };
        // Return the TMDB-recommended titles that ALREADY exist in our DB — no importing.
        async function dbMatches(tmdbItems) {
            if (!tmdbItems.length)
                return [];
            const ids = tmdbItems.map(r => String(r.id));
            const existing = await Movie_1.Movie.find({ tmdbId: { $in: ids }, type: 'movie' }).select('-sources').lean();
            const byId = new Map(existing.map((m) => [String(m.tmdbId).replace(/^movie_/, ''), m]));
            return tmdbItems
                .map(r => byId.get(String(r.id)))
                .filter((d) => !!d && !!d.posterUrl && String(d._id) !== movieId);
        }
        // TMDB recommendations/similar (only used to rank what we already have)
        let recMatches = [];
        let simMatches = [];
        if (rawId) {
            const [recData, simData] = await Promise.allSettled([
                (0, tmdb_1.tmdbFetch)(`/movie/${rawId}/recommendations?language=en-US&page=1`),
                (0, tmdb_1.tmdbFetch)(`/movie/${rawId}/similar?language=en-US&page=1`),
            ]);
            recMatches = await dbMatches(recData.status === 'fulfilled' ? (recData.value.results || []) : []);
            simMatches = await dbMatches(simData.status === 'fulfilled' ? (simData.value.results || []) : []);
        }
        // Top up from our DB by genre/language so rows stay full — still no imports.
        const topGenres = movie.genres.slice(0, 2);
        const [genrePool, broadPool] = await Promise.all([
            Movie_1.Movie.find({ _id: { $ne: movie._id }, genres: { $in: topGenres }, language: { $in: movie.language }, streamVerified: { $ne: false }, rating: { $gte: 5 }, posterUrl: { $ne: '' } }).sort({ rating: -1, releaseYear: -1 }).limit(80).select('-sources').lean(),
            Movie_1.Movie.find({ _id: { $ne: movie._id }, genres: { $nin: topGenres }, language: { $in: movie.language }, streamVerified: { $ne: false }, rating: { $gte: 6.5 }, posterUrl: { $ne: '' } }).sort({ rating: -1, releaseYear: -1 }).limit(80).select('-sources').lean(),
        ]);
        const seen = new Set([rawId]); // never include the movie itself
        const result = {
            similar: pick([...recMatches, ...shuffle(genrePool)], seen),
            youMayLove: pick([...simMatches, ...shuffle(broadPool)], seen),
        };
        relatedCache.set(req.params.slug, { data: result, ts: Date.now() });
        res.json(result);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// Return slugs for collection parts that actually exist — accepts tmdbIds (bare numbers)
router.get('/check-collection', async (req, res) => {
    try {
        const raw = req.query.ids;
        if (!raw || typeof raw !== 'string')
            return res.json([]);
        const ids = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 30);
        // DB may store as "123" or "movie_123" — match both
        const orList = ids.flatMap(id => [id, `movie_${id}`]);
        const found = await Movie_1.Movie.find({ tmdbId: { $in: orList }, type: 'movie' })
            .select('tmdbId slug')
            .lean();
        // Return map: bare_tmdb_id → slug
        const result = {};
        for (const m of found) {
            const bare = String(m.tmdbId).replace(/^movie_/, '');
            result[bare] = m.slug;
        }
        res.json(result);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/:slug', async (req, res) => {
    try {
        const movie = await Movie_1.Movie.findOne({ slug: req.params.slug, type: 'movie' });
        if (!movie)
            return res.status(404).json({ error: 'Movie not found' });
        res.json(movie);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
