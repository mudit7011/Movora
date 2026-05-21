"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminMoviesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const mongoose_1 = __importDefault(require("mongoose"));
const Movie_1 = require("../../models/Movie");
const authenticate_1 = require("../../middleware/authenticate");
const router = (0, express_1.Router)();
exports.adminMoviesRouter = router;
router.use(authenticate_1.authenticate);
const sourceSchema = zod_1.z.object({
    serverName: zod_1.z.string(),
    url: zod_1.z.string().url(),
    type: zod_1.z.enum(['iframe', 'direct']),
    quality: zod_1.z.string().default('HD'),
    isWorking: zod_1.z.boolean().default(true),
});
const movieSchema = zod_1.z.object({
    tmdbId: zod_1.z.string(),
    title: zod_1.z.string(),
    titleHindi: zod_1.z.string().optional(),
    slug: zod_1.z.string(),
    language: zod_1.z.array(zod_1.z.string()),
    genres: zod_1.z.array(zod_1.z.string()),
    releaseYear: zod_1.z.number(),
    rating: zod_1.z.number(),
    runtime: zod_1.z.number(),
    synopsis: zod_1.z.string(),
    posterUrl: zod_1.z.string().url(),
    backdropUrl: zod_1.z.string().url(),
    trailerKey: zod_1.z.string().optional(),
    cast: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), character: zod_1.z.string().optional(), photo: zod_1.z.string().optional() })),
    sources: zod_1.z.array(sourceSchema),
    scrapedFrom: zod_1.z.string(),
});
router.get('/', async (_req, res) => {
    try {
        const movies = await Movie_1.Movie.find().sort({ createdAt: -1 });
        res.json(movies);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.post('/', async (req, res) => {
    const parsed = movieSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues });
        return;
    }
    try {
        const movie = await Movie_1.Movie.create(parsed.data);
        res.status(201).json(movie);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.patch('/:id', async (req, res) => {
    if (!mongoose_1.default.isValidObjectId(req.params.id)) {
        res.status(400).json({ error: 'Invalid movie id' });
        return;
    }
    const parsed = movieSchema.partial().safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues });
        return;
    }
    try {
        const movie = await Movie_1.Movie.findByIdAndUpdate(req.params.id, { $set: parsed.data }, { new: true, runValidators: true });
        if (!movie) {
            res.status(404).json({ error: 'Movie not found' });
            return;
        }
        res.json(movie);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.delete('/:id', async (req, res) => {
    if (!mongoose_1.default.isValidObjectId(req.params.id)) {
        res.status(400).json({ error: 'Invalid movie id' });
        return;
    }
    try {
        const movie = await Movie_1.Movie.findByIdAndDelete(req.params.id);
        if (!movie) {
            res.status(404).json({ error: 'Movie not found' });
            return;
        }
        res.json({ message: 'Deleted' });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
