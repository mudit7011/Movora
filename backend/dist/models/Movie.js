"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Movie = void 0;
const mongoose_1 = require("mongoose");
const sourceSchema = new mongoose_1.Schema({
    serverName: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, enum: ['iframe', 'direct'], required: true },
    quality: { type: String, default: 'HD' },
    isWorking: { type: Boolean, default: true },
    lastChecked: { type: Date, default: Date.now },
});
const movieSchema = new mongoose_1.Schema({
    tmdbId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    titleHindi: String,
    slug: { type: String, required: true, unique: true },
    type: { type: String, enum: ['movie', 'tvshow'], default: 'movie' },
    language: [String],
    genres: [String],
    releaseYear: Number,
    rating: Number,
    runtime: Number,
    synopsis: String,
    posterUrl: String,
    backdropUrl: String,
    trailerKey: String,
    cast: [{ name: String, character: String, photo: String }],
    sources: [sourceSchema],
    streamVerified: { type: Boolean, default: true },
    scrapedFrom: String,
    seasons: Number,
    totalEpisodes: Number,
    status: String,
    seasonData: [{ seasonNumber: Number, episodeCount: Number, name: String }],
}, { timestamps: true });
movieSchema.index({ title: 'text', synopsis: 'text' }, { language_override: 'lang' });
movieSchema.index({ genres: 1 });
movieSchema.index({ language: 1 });
movieSchema.index({ releaseYear: 1 });
movieSchema.index({ rating: -1 });
movieSchema.index({ streamVerified: 1 });
// Compound indexes for the browse pages (/movies, /shows). Without these, the
// type + rating/year-sorted queries scan the whole collection (10-15s on free-tier
// Mongo). These let MongoDB serve type-filtered, pre-sorted results straight from
// the index — query drops to <1s. Covers both type:'movie' and type:'tvshow'.
movieSchema.index({ type: 1, rating: -1, releaseYear: -1 });
movieSchema.index({ type: 1, createdAt: -1 });
exports.Movie = (0, mongoose_1.model)('Movie', movieSchema);
