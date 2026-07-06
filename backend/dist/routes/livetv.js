"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.livetvRouter = void 0;
const express_1 = require("express");
exports.livetvRouter = (0, express_1.Router)();
// English-speaking country playlists from iptv-org (direct .m3u8 live TV).
// We keep only Sports/News channels, and only ones that pass a live health-check —
// so users see recognizable English channels, not foreign-language clutter.
const COUNTRIES = ['us', 'uk', 'ca', 'au', 'nz', 'ie'];
const PLAYLIST = (c) => `https://iptv-org.github.io/iptv/countries/${c}.m3u`;
// India has 800+ channels, mostly regional languages / pay-TV. We allow only
// recognizable free Hindi channels (premium Sony/Zee/Colors/Star are DRM+geo-locked
// and don't work anyway). Regional-language variants are excluded.
// Hindi NEWS channels join the "News" group; all other Hindi (serials, movies,
// sport, general) go into a single "Hindi" group.
const INDIA_REGIONAL = /\b(Marathi|Bangla|Bengali|Tamil|Telugu|Kannada|Gujarati|Malayalam|Bhojpuri|Punjabi|Odia|Oriya|Assam(?:ese)?|Kalinga|Nepali|Urdu|Sindhi|Konkani|Tulu|Manipuri)\b/i;
const INDIA_NEWS = /\b(DD News|DD India|Aaj Tak|ABP News|Zee News|NDTV|India TV|News18 India|Republic Bharat|WION|Times Now|CNBC Awaaz|TV9 Bharatvarsh|News Nation|Sansad TV|Bharat24)\b/i;
const INDIA_HINDI = /\b(DD Sports|DD National|DD Bharati|Big Magic|Shemaroo|Goldmines|Manoranjan|B4U Movies|Dhamaka Movies)\b/i;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const ORIGIN = 'https://watchmovora.com';
const REFRESH_MS = 20 * 60 * 1000;
const CHECK_CONCURRENCY = 6; // low, to stay light on the 512MB free instance
const CHECK_TIMEOUT = 6000;
const MAX_READ_BYTES = 128 * 1024; // only need the top of the playlist; never buffer a live stream
// Football/soccer channels get their own headline group + top billing (FIFA is why this exists).
const FOOTBALL = /\b(FIFA|Golazo|Football|Soccer|beIN|LaLiga|Premier League|UEFA|MUTV)\b/i;
let channelsCache = [];
let lastRefresh = 0;
let refreshing = false;
function b64url(s) {
    return Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function cleanName(raw) {
    return raw.replace(/\s*\((?:\d+p|[^)]*)\)/gi, '').replace(/\s*\[[^\]]*\]/g, '').trim() || raw.trim();
}
// Collapse iptv-org's messy multi-group titles ("Auto;Outdoor;Sports") to one clean bucket.
function normalizeGroup(group) {
    const g = group.toLowerCase();
    if (/news/.test(g))
        return 'News';
    if (/sport/.test(g))
        return 'Sports';
    return null;
}
// Parse an M3U. `mode='english'` keeps Sports/News by group-title; `mode='india'`
// keeps only allowlisted channels (any group) and buckets them Sports vs Hindi.
function parseM3U(text, mode) {
    const out = [];
    const lines = text.split('\n');
    let pending = null;
    for (const line of lines) {
        const t = line.trim();
        if (t.startsWith('#EXTINF')) {
            const rawGroup = /group-title="([^"]*)"/.exec(t)?.[1] || '';
            const logo = /tvg-logo="([^"]*)"/.exec(t)?.[1] || null;
            const name = cleanName(t.slice(t.lastIndexOf(',') + 1).trim());
            let group = null;
            if (mode === 'india') {
                if (!INDIA_REGIONAL.test(name)) {
                    if (INDIA_NEWS.test(name))
                        group = 'News';
                    else if (INDIA_HINDI.test(name))
                        group = 'Hindi';
                }
            }
            else {
                group = normalizeGroup(rawGroup);
                if (group === 'Sports' && FOOTBALL.test(name))
                    group = 'Football';
            }
            pending = group ? { name, logo, group } : null;
        }
        else if (t.startsWith('#')) {
            // skip #EXTVLCOPT and other directives, keep pending
        }
        else if (t) {
            if (pending && t.includes('.m3u8'))
                out.push({ ...pending, url: t, region: mode === 'india' ? 'in' : 'en' });
            pending = null;
        }
    }
    return out;
}
// Read at most MAX_READ_BYTES then stop — never buffer a full live stream into memory.
async function readCapped(r) {
    const reader = r.body?.getReader();
    if (!reader)
        return '';
    const chunks = [];
    let total = 0;
    try {
        while (total < MAX_READ_BYTES) {
            const { done, value } = await reader.read();
            if (done)
                break;
            chunks.push(Buffer.from(value));
            total += value.length;
        }
    }
    finally {
        try {
            await reader.cancel();
        }
        catch { /* ignore */ }
    }
    return Buffer.concat(chunks).toString('utf8');
}
async function checkChannel(url) {
    try {
        const r = await fetch(url, {
            headers: { 'User-Agent': UA, 'Origin': ORIGIN, 'Referer': ORIGIN },
            signal: AbortSignal.timeout(CHECK_TIMEOUT),
        });
        if (!r.ok) {
            try {
                await r.body?.cancel();
            }
            catch { /* */ }
            return { alive: false, direct: false, maxHeight: 0 };
        }
        const ct = r.headers.get('content-type') || '';
        const text = await readCapped(r);
        const alive = text.includes('#EXTM3U') || ct.includes('mpegurl');
        const acao = r.headers.get('access-control-allow-origin');
        let maxHeight = 0;
        for (const m of text.matchAll(/RESOLUTION=\d+x(\d+)/gi))
            maxHeight = Math.max(maxHeight, Number(m[1]));
        return { alive, direct: alive && (acao === '*' || acao === ORIGIN), maxHeight };
    }
    catch {
        return { alive: false, direct: false, maxHeight: 0 };
    }
}
// Strip quality tokens so "DD National HD" and "DD National SD" collapse to one card.
function baseName(n) {
    return n.replace(/\s*\b(FHD|UHD|4K|HD|SD)\b/gi, '').replace(/\s{2,}/g, ' ').trim() || n;
}
async function mapPool(items, fn, n) {
    const results = new Array(items.length);
    let i = 0;
    async function worker() {
        while (i < items.length) {
            const idx = i++;
            results[idx] = await fn(items[idx]);
        }
    }
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => worker()));
    return results;
}
async function refresh() {
    if (refreshing)
        return;
    refreshing = true;
    try {
        // English countries → Sports/News by group; India → allowlisted Hindi/DD only.
        const fetchText = async (url) => {
            try {
                const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
                return r.ok ? await r.text() : '';
            }
            catch {
                return '';
            }
        };
        const engTexts = await Promise.all(COUNTRIES.map(c => fetchText(PLAYLIST(c))));
        const indiaText = await fetchText(PLAYLIST('in'));
        const byName = new Map();
        const add = (chs) => {
            for (const ch of chs) {
                const key = ch.name.toLowerCase();
                if (!byName.has(key))
                    byName.set(key, ch);
            }
        };
        for (const text of engTexts)
            add(parseM3U(text, 'english'));
        add(parseM3U(indiaText, 'india'));
        const parsed = [...byName.values()];
        const checked = await mapPool(parsed, async (ch) => {
            const { alive, direct, maxHeight } = await checkChannel(ch.url);
            return { ch, alive, direct, maxHeight };
        }, CHECK_CONCURRENCY);
        // Collapse HD/SD variants of the same channel, preferring the higher-quality feed.
        const best = new Map();
        for (const c of checked) {
            if (!c.alive)
                continue;
            const hd = c.maxHeight >= 720 || /\b(HD|FHD|UHD|4K)\b/i.test(c.ch.name);
            const name = baseName(c.ch.name);
            const key = `${c.ch.group}:${name.toLowerCase()}`;
            const cand = { id: b64url(c.ch.url), name, logo: c.ch.logo, group: c.ch.group, url: c.ch.url, direct: c.direct, hd, region: c.ch.region, _h: c.maxHeight };
            const prev = best.get(key);
            if (!prev || (hd && !prev.hd) || (hd === prev.hd && c.maxHeight > prev._h))
                best.set(key, cand);
        }
        // "All" view order: Football (FIFA & co.) first, then Hindi news, then other
        // Hindi, then English sports, then English news.
        const rank = (c) => c.group === 'Football' ? 0
            : c.region === 'in' ? (c.group === 'News' ? 1 : 2)
                : (c.group === 'Sports' ? 3 : 4);
        channelsCache = [...best.values()]
            .map(({ _h, ...c }) => c)
            .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
        lastRefresh = Date.now();
        console.log(`[livetv] refreshed: ${channelsCache.length}/${parsed.length} Hindi/English Sports/News channels live`);
    }
    catch (e) {
        console.error('[livetv] refresh failed', e);
    }
    finally {
        refreshing = false;
    }
}
// ─── Endpoints ───────────────────────────────────────────────────────────────
exports.livetvRouter.get('/channels', (_req, res) => {
    if (Date.now() - lastRefresh > REFRESH_MS && !refreshing)
        void refresh();
    res.json({ channels: channelsCache, updatedAt: lastRefresh, refreshing: refreshing && channelsCache.length === 0 });
});
void refresh();
setInterval(() => void refresh(), REFRESH_MS);
