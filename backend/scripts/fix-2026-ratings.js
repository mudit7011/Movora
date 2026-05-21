"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Fixes inflated ratings for 2025-2026 movies using OMDB (real IMDb data).
 * Run: npx ts-node scripts/fix-2026-ratings.ts
 */
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const OMDB_KEY = process.env.OMDB_API_KEY || '1363d531';
const OMDB_BASE = 'https://www.omdbapi.com';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function getOmdbRating(imdbId) {
    try {
        const res = await fetch(`${OMDB_BASE}/?i=${imdbId}&apikey=${OMDB_KEY}`);
        if (!res.ok)
            return null;
        const data = await res.json();
        if (data.Response === 'False' || !data.imdbRating || data.imdbRating === 'N/A')
            return null;
        return parseFloat(data.imdbRating);
    }
    catch {
        return null;
    }
}
async function run() {
    await mongoose_1.default.connect(process.env.MONGODB_URI);
    console.log('Connected');
    const db = mongoose_1.default.connection.db;
    // Fix: stray language codes
    const stray = await db.collection('movies').deleteMany({ language: { $in: ['TL', 'PT', 'BN', 'MR', 'PA'] } });
    console.log(`Deleted ${stray.deletedCount} stray language-code movies`);
    // Fix: 2025-2026 movies with OMDB
    const movies = await db.collection('movies').find({
        releaseYear: { $gte: 2025 },
        imdbId: { $exists: true, $ne: '' }
    }).toArray();
    console.log(`Fixing ratings for ${movies.length} movies from 2025-2026...`);
    let fixed = 0;
    for (const movie of movies) {
        const rating = await getOmdbRating(movie.imdbId);
        if (rating !== null) {
            await db.collection('movies').updateOne({ _id: movie._id }, { $set: { rating } });
            if (movie.rating !== rating) {
                console.log(`  ${movie.title}: ${movie.rating} → ${rating}`);
                fixed++;
            }
        }
        await sleep(120);
    }
    console.log(`Updated ${fixed} ratings. Done.`);
    await mongoose_1.default.disconnect();
}
run().catch(console.error);
