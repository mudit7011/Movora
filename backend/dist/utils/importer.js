"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LANG_MAP = void 0;
exports.slugify = slugify;
exports.importMovie = importMovie;
exports.importShow = importShow;
const Movie_1 = require("../models/Movie");
const BlockedContent_1 = require("../models/BlockedContent");
const tmdb_1 = require("./tmdb");
const IMG_W = 'https://image.tmdb.org/t/p/w500';
const IMG_O = 'https://image.tmdb.org/t/p/original';
const IMG_FACE = 'https://image.tmdb.org/t/p/w185';
exports.LANG_MAP = {
    en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu',
    ml: 'Malayalam', ko: 'Korean', ja: 'Japanese', fr: 'French',
    es: 'Spanish', de: 'German', zh: 'Chinese', it: 'Italian',
};
function slugify(title, year) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + year;
}
async function importMovie(id, opts) {
    try {
        const blocked = await BlockedContent_1.BlockedContent.exists({ tmdbId: String(id) });
        if (blocked)
            return { status: 'skipped' };
        const exists = await Movie_1.Movie.exists({ tmdbId: String(id) });
        if (exists)
            return { status: 'skipped' };
        const [detail, credits, videos] = await Promise.all([
            (0, tmdb_1.tmdbFetch)(`/movie/${id}?language=en-US`),
            (0, tmdb_1.tmdbFetch)(`/movie/${id}/credits?language=en-US`),
            (0, tmdb_1.tmdbFetch)(`/movie/${id}/videos?language=en-US`),
        ]);
        if (!detail?.title)
            return { status: 'error' };
        const title = detail.title;
        const year = parseInt((detail.release_date || '0').slice(0, 4)) || 0;
        // Quality gate — never persist content the site doesn't surface anyway.
        // Stops the DB from bloating with obscure/old/unrated junk on every import path.
        // Bypassed for explicitly-wanted imports (e.g. missing parts of a collection).
        if (!opts?.bypassGate) {
            if (!detail.poster_path)
                return { status: 'skipped' };
            if (year && year < 2000)
                return { status: 'skipped' };
            if ((detail.vote_average || 0) <= 0 || (detail.vote_count || 0) < 5)
                return { status: 'skipped' };
            if (detail.runtime && detail.runtime < 40)
                return { status: 'skipped' };
        }
        const trailer = (videos.results || []).find((v) => v.type === 'Trailer' && v.site === 'YouTube');
        const cast = (credits.cast || []).slice(0, 15).map((c) => ({
            name: c.name, character: c.character || '',
            photo: c.profile_path ? `${IMG_FACE}${c.profile_path}` : undefined,
        }));
        await Movie_1.Movie.create({
            tmdbId: String(id),
            type: 'movie',
            title,
            slug: slugify(title, year),
            language: [exports.LANG_MAP[detail.original_language] || detail.original_language || 'English'],
            genres: (detail.genres || []).map((g) => g.name),
            releaseYear: year,
            rating: Math.round((detail.vote_average || 0) * 10) / 10,
            runtime: detail.runtime || 0,
            synopsis: detail.overview || '',
            posterUrl: detail.poster_path ? `${IMG_W}${detail.poster_path}` : '',
            backdropUrl: detail.backdrop_path ? `${IMG_O}${detail.backdrop_path}` : '',
            trailerKey: trailer?.key,
            cast,
            sources: [
                { serverName: 'Server 1', url: `https://player.videasy.to/movie/${id}?color=%2306D6E0&autoplay=1&overlay=true`, type: 'iframe', quality: 'HD', isWorking: true },
                { serverName: 'Server 2', url: `https://vidlink.pro/movie/${id}?primaryColor=06D6E0&autoplay=true`, type: 'iframe', quality: 'HD', isWorking: true },
                { serverName: 'Server 3', url: `https://embedmaster.link/fljq7ku6ysokw3og/movie/${id}`, type: 'iframe', quality: 'HD', isWorking: true },
                { serverName: 'Server 4', url: `https://streamvaultsrc.click/embed/movie/${id}?autoplay=true&muted=true&color=%2306D6E0`, type: 'iframe', quality: 'HD', isWorking: true },
            ],
            streamVerified: true,
            scrapedFrom: 'realtime',
        });
        return { status: 'added', title };
    }
    catch (e) {
        if (e?.code === 11000)
            return { status: 'skipped' };
        return { status: 'error' };
    }
}
async function importShow(id) {
    try {
        const blocked = await BlockedContent_1.BlockedContent.exists({ tmdbId: `tv_${id}` });
        if (blocked)
            return { status: 'skipped' };
        const exists = await Movie_1.Movie.exists({ tmdbId: `tv_${id}` });
        if (exists)
            return { status: 'skipped' };
        const [detail, credits, videos] = await Promise.all([
            (0, tmdb_1.tmdbFetch)(`/tv/${id}?language=en-US`),
            (0, tmdb_1.tmdbFetch)(`/tv/${id}/credits?language=en-US`),
            (0, tmdb_1.tmdbFetch)(`/tv/${id}/videos?language=en-US`),
        ]);
        if (!detail?.name)
            return { status: 'error' };
        const title = detail.name;
        const year = parseInt((detail.first_air_date || '0').slice(0, 4)) || 0;
        // Quality gate — never persist content the site doesn't surface anyway.
        if (!detail.poster_path)
            return { status: 'skipped' };
        if (year && year < 2000)
            return { status: 'skipped' };
        if ((detail.vote_average || 0) <= 0 || (detail.vote_count || 0) < 5)
            return { status: 'skipped' };
        const trailer = (videos.results || []).find((v) => v.type === 'Trailer' && v.site === 'YouTube');
        const cast = (credits.cast || []).slice(0, 15).map((c) => ({
            name: c.name, character: c.character || '',
            photo: c.profile_path ? `${IMG_FACE}${c.profile_path}` : undefined,
        }));
        const validSeasons = (detail.seasons || []).filter((s) => s.season_number > 0);
        // Skip daily soaps: any season with >100 episodes
        const isDailySoap = validSeasons.some((s) => s.episode_count > 100);
        if (isDailySoap)
            return { status: 'skipped' };
        await Movie_1.Movie.create({
            tmdbId: `tv_${id}`,
            type: 'tvshow',
            title,
            slug: slugify(title, year),
            language: [exports.LANG_MAP[detail.original_language] || detail.original_language || 'English'],
            genres: (detail.genres || []).map((g) => g.name),
            releaseYear: year,
            rating: Math.round((detail.vote_average || 0) * 10) / 10,
            runtime: detail.episode_run_time?.[0] || 0,
            synopsis: detail.overview || '',
            posterUrl: detail.poster_path ? `${IMG_W}${detail.poster_path}` : '',
            backdropUrl: detail.backdrop_path ? `${IMG_O}${detail.backdrop_path}` : '',
            trailerKey: trailer?.key,
            cast,
            sources: [
                { serverName: 'Server 1', url: `https://player.videasy.to/tv/${id}/1/1?color=%2306D6E0&autoplay=1&nextEpisode=true&episodeSelector=true&overlay=true`, type: 'iframe', quality: 'HD', isWorking: true },
                { serverName: 'Server 2', url: `https://vidlink.pro/tv/${id}/1/1?primaryColor=06D6E0&autoplay=true&nextbutton=true`, type: 'iframe', quality: 'HD', isWorking: true },
                { serverName: 'Server 3', url: `https://embedmaster.link/fljq7ku6ysokw3og/tv/${id}/1/1`, type: 'iframe', quality: 'HD', isWorking: true },
                { serverName: 'Server 4', url: `https://streamvaultsrc.click/embed/tv/${id}/1/1?autoplay=true&muted=true&color=%2306D6E0`, type: 'iframe', quality: 'HD', isWorking: true },
            ],
            streamVerified: true,
            scrapedFrom: 'realtime',
            seasons: validSeasons.length,
            totalEpisodes: detail.number_of_episodes || 0,
            status: detail.status || '',
            seasonData: validSeasons.map((s) => ({ seasonNumber: s.season_number, episodeCount: s.episode_count, name: s.name })),
        });
        return { status: 'added', title };
    }
    catch (e) {
        if (e?.code === 11000)
            return { status: 'skipped' };
        return { status: 'error' };
    }
}
