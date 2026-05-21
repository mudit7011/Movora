"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Corrects language labels in MongoDB by re-checking TMDB's original_language.
 * Run: npx ts-node scripts/fix-languages.ts
 */
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const BEARER = process.env.TMDB_BEARER;
const BASE = 'https://api.themoviedb.org/3';
const LANG_LABEL = {
    hi: 'Hindi', en: 'English', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam',
    bn: 'Bengali', mr: 'Marathi', pa: 'Punjabi', ko: 'Korean', ja: 'Japanese',
    zh: 'Chinese', fr: 'French', es: 'Spanish', de: 'German', it: 'Italian',
};
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function getOriginalLang(tmdbId) {
    try {
        const res = await fetch(`${BASE}/movie/${tmdbId}?language=en-US`, {
            headers: { Authorization: `Bearer ${BEARER}`, Accept: 'application/json' },
        });
        if (!res.ok)
            return null;
        const data = await res.json();
        return data.original_language || null;
    }
    catch {
        return null;
    }
}
async function main() {
    if (!BEARER) {
        console.error('TMDB_BEARER not set');
        process.exit(1);
    }
    await mongoose_1.default.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    const col = mongoose_1.default.connection.collection('movies');
    const movies = await col
        .find({ tmdbId: { $exists: true } }, { projection: { _id: 1, tmdbId: 1, language: 1, title: 1 } })
        .toArray();
    console.log(`Checking ${movies.length} movies...\n`);
    let checked = 0, fixed = 0, errors = 0;
    for (const movie of movies) {
        checked++;
        process.stdout.write(`\r  [${checked}/${movies.length}] fixed=${fixed} errors=${errors}   `);
        const origLang = await getOriginalLang(movie.tmdbId);
        if (!origLang) {
            errors++;
            continue;
        }
        const correctLabel = LANG_LABEL[origLang] || origLang.toUpperCase();
        const currentLabel = Array.isArray(movie.language) ? movie.language[0] : movie.language;
        if (currentLabel !== correctLabel) {
            await col.updateOne({ _id: movie._id }, { $set: { language: [correctLabel] } });
            process.stdout.write(`\n  Fixed: "${movie.title}"  ${currentLabel} → ${correctLabel}\n`);
            fixed++;
        }
        await sleep(80);
    }
    console.log(`\n\n✅ Done! Checked ${checked}, fixed ${fixed}, errors ${errors}`);
    await mongoose_1.default.disconnect();
}
main().catch(err => { console.error(err); process.exit(1); });
