"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sportsRouter = void 0;
const express_1 = require("express");
const url_1 = require("url");
exports.sportsRouter = (0, express_1.Router)();
const STREAMED_BASE = 'https://streamed.su';
const STREAMED_REFERER = 'https://streamed.su/';
const NOWHDTIME_BASE = 'https://nowhdtime.to';
async function fetchWithTimeout(url, opts = {}) {
    const { timeoutMs = 10000, ...fetchOpts } = opts;
    return fetch(url, { ...fetchOpts, signal: AbortSignal.timeout(timeoutMs) });
}
// Block SSRF — private/loopback ranges
const PRIVATE_IP = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$|fc|fd)/i;
function isSafeUrl(raw) {
    try {
        const u = new url_1.URL(raw);
        if (u.protocol !== 'https:')
            return false;
        const host = u.hostname;
        if (PRIVATE_IP.test(host))
            return false;
        // Must be an external host (at least one dot)
        if (!host.includes('.'))
            return false;
        return true;
    }
    catch {
        return false;
    }
}
// Rewrite m3u8 so every URI goes through our proxy
function rewriteM3u8(content, baseUrl, referer) {
    const base = new url_1.URL(baseUrl);
    const mkProxy = (uri) => {
        let abs;
        try {
            abs = new url_1.URL(uri, base).href;
        }
        catch {
            return uri;
        }
        return `/api/sports/proxy?url=${encodeURIComponent(abs)}&referer=${encodeURIComponent(referer)}`;
    };
    return content
        .split('\n')
        .map(line => {
        const trimmed = line.trim();
        if (!trimmed)
            return line;
        // Rewrite KEY URI
        if (trimmed.startsWith('#EXT-X-KEY')) {
            return line.replace(/URI="([^"]+)"/, (_, u) => `URI="${mkProxy(u)}"`);
        }
        // Rewrite MAP URI (fmp4 init segment)
        if (trimmed.startsWith('#EXT-X-MAP')) {
            return line.replace(/URI="([^"]+)"/, (_, u) => `URI="${mkProxy(u)}"`);
        }
        // Rewrite MEDIA URI (demuxed audio / subtitle sub-playlists — e.g. Samsung TV Plus / FIFA+)
        if (trimmed.startsWith('#EXT-X-MEDIA')) {
            return line.replace(/URI="([^"]+)"/, (_, u) => `URI="${mkProxy(u)}"`);
        }
        // Non-comment line = segment or sub-playlist URI
        if (!trimmed.startsWith('#')) {
            return mkProxy(trimmed);
        }
        return line;
    })
        .join('\n');
}
// ─── Events list ─────────────────────────────────────────────────────────────
// In-memory cache: 3 minutes
let eventsCache = null;
const EVENTS_TTL = 3 * 60 * 1000;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
exports.sportsRouter.get('/events', async (_req, res) => {
    if (eventsCache && Date.now() - eventsCache.ts < EVENTS_TTL) {
        res.json(eventsCache.data);
        return;
    }
    // Try streamed.su first (works from Render/US); fall back to nowhdtime.to (works anywhere)
    const sources = [
        { url: `${STREAMED_BASE}/api/matches/all`, referer: STREAMED_REFERER, timeoutMs: 3000 },
        { url: `${NOWHDTIME_BASE}/api/matches/all`, referer: `${NOWHDTIME_BASE}/`, timeoutMs: 8000 },
    ];
    for (const src of sources) {
        try {
            const r = await fetchWithTimeout(src.url, {
                timeoutMs: src.timeoutMs,
                headers: { 'User-Agent': UA, 'Referer': src.referer, 'Accept': 'application/json' },
            });
            if (!r.ok)
                continue;
            const matches = await r.json();
            if (!Array.isArray(matches) || matches.length === 0)
                continue;
            const data = { events: matches };
            eventsCache = { data, ts: Date.now() };
            res.json(data);
            return;
        }
        catch { /* try next */ }
    }
    if (eventsCache) {
        res.json(eventsCache.data);
        return;
    }
    res.status(502).json({ error: 'Failed to fetch events' });
});
// ─── Stream URLs for a match ──────────────────────────────────────────────────
// Cache per source+matchId: 60 seconds
const streamCache = new Map();
const STREAM_TTL = 60000;
exports.sportsRouter.get('/stream/:source/:matchId', async (req, res) => {
    const { source, matchId } = req.params;
    const key = `${source}:${matchId}`;
    const hit = streamCache.get(key);
    if (hit && Date.now() - hit.ts < STREAM_TTL) {
        res.json(hit.data);
        return;
    }
    const streamSources = [
        { base: STREAMED_BASE, referer: STREAMED_REFERER, timeoutMs: 7000 },
        { base: NOWHDTIME_BASE, referer: `${NOWHDTIME_BASE}/`, timeoutMs: 8000 },
    ];
    for (const src of streamSources) {
        try {
            const r = await fetchWithTimeout(`${src.base}/api/stream/${encodeURIComponent(source)}/${encodeURIComponent(matchId)}`, { timeoutMs: src.timeoutMs, headers: { 'User-Agent': UA, 'Referer': src.referer, 'Accept': 'application/json' } });
            if (!r.ok)
                continue;
            const streams = await r.json();
            if (!Array.isArray(streams))
                continue;
            const data = { streams, referer: src.referer };
            streamCache.set(key, { data, ts: Date.now() });
            if (streamCache.size > 500) {
                const oldest = [...streamCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
                streamCache.delete(oldest[0]);
            }
            res.json(data);
            return;
        }
        catch { /* try next */ }
    }
    const stale = streamCache.get(key);
    if (stale) {
        res.json(stale.data);
        return;
    }
    // Last resort: construct masaladosa embed URLs directly.
    // masaladosa serves all sources (echo, admin, golf, etc.) at a predictable URL
    // and doesn't check the referring domain — verified HTTP 200 from both India and SG.
    const MASALADOSA_BASE = 'https://masaladosa.streammafia.to';
    const fallbackStreams = [1, 2].map(n => ({
        id: matchId,
        streamNo: n,
        language: 'English',
        hd: n === 1,
        embedUrl: `${MASALADOSA_BASE}/embed/${encodeURIComponent(source)}/${encodeURIComponent(matchId)}/${n}`,
        source,
    }));
    const fallbackData = { streams: fallbackStreams, referer: `${MASALADOSA_BASE}/` };
    streamCache.set(key, { data: fallbackData, ts: Date.now() });
    if (streamCache.size > 500) {
        const oldest = [...streamCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
        streamCache.delete(oldest[0]);
    }
    res.json(fallbackData);
});
// ─── HLS proxy ───────────────────────────────────────────────────────────────
exports.sportsRouter.get('/proxy', async (req, res) => {
    const urlParam = req.query.url;
    const referer = req.query.referer || STREAMED_REFERER;
    if (!urlParam) {
        res.status(400).json({ error: 'url required' });
        return;
    }
    if (!isSafeUrl(urlParam)) {
        res.status(400).json({ error: 'Invalid URL' });
        return;
    }
    try {
        const upstream = await fetch(urlParam, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Referer': referer,
                'Origin': (() => { try {
                    return new url_1.URL(referer).origin;
                }
                catch {
                    return referer;
                } })(),
            },
            signal: AbortSignal.timeout(20000),
        });
        const ct = upstream.headers.get('content-type') || '';
        const isPlaylist = ct.includes('mpegurl') || ct.includes('x-mpegURL') || urlParam.includes('.m3u8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-store');
        if (isPlaylist) {
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            const text = await upstream.text();
            // Resolve relative URIs against the FINAL url after redirects (Samsung TV Plus /
            // Pluto FAST channels 302 to a session URL; the original url gives wrong paths → 404).
            res.send(rewriteM3u8(text, upstream.url || urlParam, referer));
        }
        else {
            res.setHeader('Content-Type', ct || 'application/octet-stream');
            const buf = await upstream.arrayBuffer();
            res.send(Buffer.from(buf));
        }
    }
    catch (e) {
        console.error('[sports/proxy]', e);
        res.status(502).json({ error: 'Proxy error' });
    }
});
