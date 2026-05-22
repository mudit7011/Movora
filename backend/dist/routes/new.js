"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newRouter = void 0;
const express_1 = require("express");
const Movie_1 = require("../models/Movie");
const router = (0, express_1.Router)();
exports.newRouter = router;
const EXCLUDED_GENRES = ['Music', 'Talk', 'News', 'Reality', 'Soap', 'TV Movie'];
const currentYear = new Date().getFullYear();
// Returns latest movies + latest shows interleaved, sorted by releaseYear desc
router.get('/', async (_req, res) => {
    try {
        const baseFilter = {
            streamVerified: { $ne: false },
            language: { $in: ['Hindi', 'English'] },
            releaseYear: { $gte: currentYear - 2 },
            rating: { $gte: 5, $lte: 9.5 },
            genres: { $nin: EXCLUDED_GENRES },
            posterUrl: { $ne: '' },
            backdropUrl: { $ne: '' },
        };
        const [movies, shows] = await Promise.all([
            Movie_1.Movie.find({ ...baseFilter, type: 'movie', runtime: { $gte: 60 } })
                .sort({ createdAt: -1 })
                .limit(60)
                .select('-sources'),
            Movie_1.Movie.find({ ...baseFilter, type: 'tvshow' })
                .sort({ createdAt: -1 })
                .limit(60)
                .select('-sources'),
        ]);
        // Interleave: 2 movies then 1 show, repeating
        const result = [];
        let mi = 0, si = 0;
        while (mi < movies.length || si < shows.length) {
            if (mi < movies.length)
                result.push(movies[mi++]);
            if (mi < movies.length)
                result.push(movies[mi++]);
            if (si < shows.length)
                result.push(shows[si++]);
        }
        res.json(result);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
