"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearVideasyCache = clearVideasyCache;
exports.scrapeVideasy = scrapeVideasy;
const playwright_extra_1 = require("playwright-extra");
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
playwright_extra_1.chromium.use((0, puppeteer_extra_plugin_stealth_1.default)());
const cache = new Map();
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours — digitalsun URLs are valid 30 days
function cacheKey(tmdbId, type, season, episode) {
    return type === 'movie' ? `movie_${tmdbId}` : `tv_${tmdbId}_s${season}_e${episode}`;
}
function clearVideasyCache() { cache.clear(); }
function pickBestUrl(sources) {
    if (!Array.isArray(sources))
        return null;
    const prio = ['4k', '2160', '1080', '720', '480', '360', ''];
    for (const quality of prio) {
        const match = sources.find((s) => {
            const label = (s.quality || s.label || s.name || '').toLowerCase();
            return quality === '' || label.includes(quality);
        });
        if (match) {
            const url = match.url || match.stream_url || match.file || match.link || match.src;
            if (url && typeof url === 'string')
                return url;
        }
    }
    // fallback: first entry with any URL
    for (const s of sources) {
        const url = s.url || s.stream_url || s.file || s.link || s.src;
        if (url && typeof url === 'string')
            return url;
    }
    return null;
}
function extractM3u8(data) {
    if (!data)
        return null;
    // Format 1: { sources: [{url, quality}] }
    if (data.sources)
        return pickBestUrl(data.sources);
    // Format 2: { data: { sources: [...] } }
    if (data.data?.sources)
        return pickBestUrl(data.data.sources);
    // Format 3: flat array
    if (Array.isArray(data))
        return pickBestUrl(data);
    // Format 4: direct url fields
    const direct = data.url || data.stream_url || data.file || data.link || data.src;
    if (direct && typeof direct === 'string')
        return direct;
    return null;
}
async function scrapeVideasy(tmdbId, type, season, episode, forceRefresh = false) {
    const key = cacheKey(tmdbId, type, season, episode);
    const cached = cache.get(key);
    if (!forceRefresh && cached && Date.now() - cached.cachedAt < CACHE_TTL) {
        return cached.stream;
    }
    cache.delete(key);
    let browser = null;
    try {
        browser = await playwright_extra_1.chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--autoplay-policy=no-user-gesture-required',
                '--disable-features=PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies',
                '--enable-features=WebAssembly',
                '--allow-running-insecure-content',
                '--disable-web-security',
            ],
        });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            locale: 'en-US',
            viewport: { width: 1280, height: 720 },
        });
        const page = await context.newPage();
        let streamUrl = null;
        // Capture ANY m3u8 request — digitalsun fires after WASM decryption
        page.on('request', (req) => {
            const url = req.url();
            if (!url.includes('.m3u8'))
                return;
            console.log('[Videasy] m3u8 req:', url.slice(0, 120));
            if (!streamUrl)
                streamUrl = url;
        });
        const pageUrl = type === 'movie'
            ? `https://player.videasy.to/movie/${tmdbId}?color=06D6E0&autoplay=1`
            : `https://player.videasy.to/tv/${tmdbId}/${season}/${episode}?color=06D6E0&autoplay=1`;
        console.log('[Videasy] loading', pageUrl);
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        // Wait for WASM to decrypt & player to init, then click play
        await page.waitForTimeout(5000);
        if (!streamUrl) {
            try {
                await page.click('video', { timeout: 2000 });
                console.log('[Videasy] clicked video');
            }
            catch {
                try {
                    await page.click('[class*="play"], button', { timeout: 2000 });
                    console.log('[Videasy] clicked play btn');
                }
                catch { /* no button */ }
            }
        }
        // Wait up to 35s total for m3u8 request
        const deadline = Date.now() + 35000;
        while (!streamUrl && Date.now() < deadline) {
            await page.waitForTimeout(500);
        }
        if (!streamUrl) {
            console.log('[Videasy] no m3u8 found after 40s');
            return null;
        }
        const stream = { url: streamUrl, subtitles: [] };
        cache.set(key, { stream, cachedAt: Date.now() });
        return stream;
    }
    catch (err) {
        console.error('[Videasy] scrape error:', err);
        return null;
    }
    finally {
        await browser?.close();
    }
}
