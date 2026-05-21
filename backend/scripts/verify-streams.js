"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Marks movies as streamVerified=true if they appear in any embed provider's catalog.
 * Sources checked:
 *   1. vidsrc.to  — https://vidsrc.to/vapi/movie/new?page=N
 *   2. vidsrc.icu — https://vidsrc.icu/movies/latest?page=N
 *
 * Run: npx ts-node scripts/verify-streams.ts
 */
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function fetchJson(url) {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Movora/1.0)' },
    });
    if (!res.ok)
        throw new Error(`HTTP ${res.status}: ${url}`);
    return res.json();
}
async function collectVidsrcTo() {
    const ids = new Set();
    console.log('Fetching vidsrc.to catalog...');
    let page = 1;
    while (true) {
        try {
            const data = await fetchJson(`https://vidsrc.to/vapi/movie/new?page=${page}`);
            const items = data?.result?.items ?? [];
            if (items.length === 0)
                break;
            items.forEach(m => { if (m.tmdb_id)
                ids.add(String(m.tmdb_id)); });
            process.stdout.write(`\r  vidsrc.to: ${ids.size} movies (page ${page}/${data?.result?.pages ?? '?'})   `);
            if (page >= (data?.result?.pages ?? 1))
                break;
            page++;
            await sleep(150);
        }
        catch {
            await sleep(1000);
            break;
        }
    }
    console.log();
    return ids;
}
async function collectVidsrcIcu() {
    const ids = new Set();
    console.log('Fetching vidsrc.icu catalog...');
    let page = 1;
    while (page <= 200) { // cap at 200 pages
        try {
            const data = await fetchJson(`https://vidsrc.icu/movies/latest?page=${page}`);
            const items = data?.data ?? data?.results ?? data ?? [];
            if (!Array.isArray(items) || items.length === 0)
                break;
            items.forEach((m) => {
                const id = m.tmdb_id ?? m.tmdbId ?? m.id;
                if (id)
                    ids.add(String(id));
            });
            process.stdout.write(`\r  vidsrc.icu: ${ids.size} movies (page ${page})   `);
            page++;
            await sleep(150);
        }
        catch {
            break;
        }
    }
    console.log();
    return ids;
}
async function main() {
    await mongoose_1.default.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');
    const col = mongoose_1.default.connection.collection('movies');
    // Collect verified TMDB IDs from all providers
    const [fromVidsrcTo, fromVidsrcIcu] = await Promise.allSettled([
        collectVidsrcTo(),
        collectVidsrcIcu(),
    ]);
    const verifiedIds = new Set();
    if (fromVidsrcTo.status === 'fulfilled')
        fromVidsrcTo.value.forEach(id => verifiedIds.add(id));
    if (fromVidsrcIcu.status === 'fulfilled')
        fromVidsrcIcu.value.forEach(id => verifiedIds.add(id));
    console.log(`\nTotal verified TMDB IDs across all providers: ${verifiedIds.size}\n`);
    if (verifiedIds.size === 0) {
        console.log('No IDs found — check network or provider API changes.');
        await mongoose_1.default.disconnect();
        return;
    }
    // Bulk update: mark verified movies
    const verifiedArr = Array.from(verifiedIds);
    const markVerified = await col.updateMany({ tmdbId: { $in: verifiedArr } }, { $set: { streamVerified: true } });
    // Mark rest as unverified
    const markUnverified = await col.updateMany({ tmdbId: { $nin: verifiedArr } }, { $set: { streamVerified: false } });
    console.log(`✅ Marked as verified:   ${markVerified.modifiedCount}`);
    console.log(`❌ Marked as unverified: ${markUnverified.modifiedCount}`);
    // Show sample of what's now verified
    const sample = await col
        .find({ streamVerified: true }, { projection: { title: 1, releaseYear: 1, rating: 1 } })
        .sort({ releaseYear: -1, rating: -1 })
        .limit(10)
        .toArray();
    console.log('\nTop verified movies:');
    sample.forEach(m => console.log(`  ${m.title} (${m.releaseYear}) — ${m.rating}`));
    await mongoose_1.default.disconnect();
}
main().catch(err => { console.error(err); process.exit(1); });
