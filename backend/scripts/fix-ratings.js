"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Re-fetches rating, runtime, and release date from TMDB for every movie in the DB.
 * Uses OMDB for the real IMDb rating if OMDB_API_KEY is set; falls back to TMDB vote_average.
 *
 * Run: npx ts-node scripts/fix-ratings.ts
 */
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const BEARER = process.env.TMDB_BEARER;
const OMDB_KEY = process.env.OMDB_API_KEY ?? '';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const OMDB_BASE = 'https://www.omdbapi.com';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function tmdbGet(endpoint) {
    const res = await fetch(`${TMDB_BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${BEARER}`, Accept: 'application/json' },
    });
    if (!res.ok)
        throw new Error(`TMDB ${res.status}: ${endpoint}`);
    return res.json();
}
async function omdbGet(imdbId) {
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
async function main() {
    if (!BEARER) {
        console.error('TMDB_BEARER not set');
        process.exit(1);
    }
    await mongoose_1.default.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    const col = mongoose_1.default.connection.collection('movies');
    const movies = await col.find({}, { projection: { tmdbId: 1, title: 1, rating: 1, runtime: 1 } }).toArray();
    console.log(`Found ${movies.length} movies to update\n`);
    if (OMDB_KEY)
        console.log('OMDB key found — will use real IMDb ratings\n');
    else
        console.log('No OMDB key — using TMDB vote_average (add OMDB_API_KEY to .env for real IMDb ratings)\n');
    let updated = 0;
    let failed = 0;
    for (let i = 0; i < movies.length; i++) {
        const movie = movies[i];
        const tmdbId = movie.tmdbId;
        if (!tmdbId) {
            failed++;
            continue;
        }
        try {
            const detail = await tmdbGet(`/movie/${tmdbId}?language=en-US`);
            // Prefer OMDB imdb rating, fall back to TMDB vote_average
            const imdbRating = await omdbGet(detail.imdb_id);
            const rating = imdbRating ?? (Math.round((detail.vote_average || 0) * 10) / 10);
            const runtime = detail.runtime || movie.runtime || 0;
            const releaseYear = detail.release_date
                ? parseInt(detail.release_date.split('-')[0])
                : undefined;
            const update = { rating, runtime, updatedAt: new Date() };
            if (releaseYear)
                update.releaseYear = releaseYear;
            await col.updateOne({ tmdbId }, { $set: update });
            updated++;
            const source = imdbRating ? 'IMDb' : 'TMDB';
            process.stdout.write(`\r[${i + 1}/${movies.length}] ${updated} updated, ${failed} failed — last: ${movie.title} → ${rating} (${source})   `);
            await sleep(100); // ~10 req/s, well within TMDB free limit
        }
        catch (e) {
            failed++;
            await sleep(500);
        }
    }
    console.log(`\n\nDone. Updated: ${updated}, Failed: ${failed}`);
    await mongoose_1.default.disconnect();
}
main().catch(err => { console.error(err); process.exit(1); });
