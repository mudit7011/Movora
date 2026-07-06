"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subtitlesRouter = void 0;
const express_1 = require("express");
const router = (0, express_1.Router)();
exports.subtitlesRouter = router;
// Wyzie aggregates subtitles (OpenSubtitles/SubDL/…) by TMDB id. Set WYZIE_KEY in the
// environment (local .env + Render). If unset, subtitle search simply returns nothing.
const WYZIE_KEY = process.env.WYZIE_KEY || '';
const WYZIE_BASE = 'https://sub.wyzie.io/search';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
// GET /api/subtitles/search?tmdb=&type=movie|tv&season=&episode=&all=1
// all=1 → every variant (multiple per language, most-downloaded first) so users can pick the
// one that matches their release. Otherwise → one best (most-downloaded) subtitle per language.
router.get('/search', async (req, res) => {
    const tmdb = String(req.query.tmdb || req.query.tmdbId || '');
    const type = String(req.query.type || 'movie');
    const season = req.query.season ? String(req.query.season) : '';
    const episode = req.query.episode ? String(req.query.episode) : '';
    if (!tmdb) {
        res.status(400).json({ error: 'tmdb required' });
        return;
    }
    const p = new URLSearchParams({ id: tmdb, key: WYZIE_KEY });
    if (type === 'tv' && season && episode) {
        p.set('season', season);
        p.set('episode', episode);
    }
    try {
        const r = await fetch(`${WYZIE_BASE}?${p.toString()}`, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(10000) });
        if (!r.ok) {
            res.json({ subtitles: [] });
            return;
        }
        const data = (await r.json());
        const all = req.query.all === '1';
        const mapped = data.map(s => ({
            lang: s.language || s.display || 'Unknown',
            display: s.display || s.language || 'Unknown',
            url: s.url,
            flag: s.flagUrl || null,
            release: s.release || s.fileName || '',
            downloads: Number(s.downloadCount || 0),
            hi: !!s.isHearingImpaired,
            origin: s.origin || '', // release type: BluRay / WEB / HDRip — helps match sync
        }));
        // Most-downloaded first (best sync/most trusted). For the auto-load, keep one per language.
        mapped.sort((a, b) => b.downloads - a.downloads);
        let subtitles = mapped;
        if (!all) {
            const seen = new Set();
            subtitles = mapped.filter(s => { if (seen.has(s.display))
                return false; seen.add(s.display); return true; });
        }
        subtitles = subtitles.slice(0, all ? 150 : 30);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.json({ subtitles });
    }
    catch {
        res.json({ subtitles: [] });
    }
});
// GET /api/subtitles/vtt?url=  → fetch the SRT and serve it as WebVTT (CORS-open).
router.get('/vtt', async (req, res) => {
    const url = String(req.query.url || '');
    if (!/^https?:\/\//i.test(url)) {
        res.status(400).json({ error: 'valid url required' });
        return;
    }
    try {
        const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(12000) });
        if (!r.ok) {
            res.status(502).end();
            return;
        }
        let text = await r.text();
        const hadHeader = /^\s*WEBVTT/.test(text);
        text = text.replace(/\r/g, '').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
        // Strip common ad cues so captions look clean (premium touch).
        const AD = /opensubtitles|osdb\.link|advertise your (product|brand)|watch online movies|api\.opensub|subscene|www\.\w+\.(org|com|link)/i;
        const body = hadHeader ? text.replace(/^\s*WEBVTT[^\n]*\n/, '') : text;
        const cleaned = body.split(/\n\s*\n/).filter(block => !AD.test(block)).join('\n\n');
        text = 'WEBVTT\n\n' + cleaned.trim() + '\n';
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(text);
    }
    catch {
        res.status(502).end();
    }
});
