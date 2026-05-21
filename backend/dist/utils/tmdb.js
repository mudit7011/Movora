"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tmdbFetch = tmdbFetch;
const https_1 = __importDefault(require("https"));
const zlib_1 = __importDefault(require("zlib"));
const dns_1 = require("dns");
let cachedIP = null;
async function resolveTmdbIP() {
    if (cachedIP)
        return cachedIP;
    return new Promise((resolve) => {
        const resolver = new dns_1.Resolver();
        resolver.setServers(['8.8.8.8', '8.8.4.4']);
        resolver.resolve4('api.themoviedb.org', (err, addresses) => {
            cachedIP = (!err && addresses[0]) ? addresses[0] : 'api.themoviedb.org';
            resolve(cachedIP);
        });
    });
}
function httpsRequest(ip, path, bearer) {
    return new Promise((resolve, reject) => {
        const req = https_1.default.request({
            host: ip,
            port: 443,
            path: `/3${path}`,
            method: 'GET',
            servername: 'api.themoviedb.org',
            headers: {
                Authorization: `Bearer ${bearer}`,
                Accept: 'application/json',
                Host: 'api.themoviedb.org',
            },
            timeout: 15000,
        }, (res) => {
            if (res.statusCode && res.statusCode >= 400) {
                reject(new Error(`TMDB ${res.statusCode}`));
                res.resume();
                return;
            }
            const enc = res.headers['content-encoding'];
            let stream = res;
            if (enc === 'gzip')
                stream = res.pipe(zlib_1.default.createGunzip());
            else if (enc === 'deflate')
                stream = res.pipe(zlib_1.default.createInflate());
            else if (enc === 'br')
                stream = res.pipe(zlib_1.default.createBrotliDecompress());
            const chunks = [];
            stream.on('data', (c) => chunks.push(c));
            stream.on('end', () => {
                try {
                    resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
                }
                catch (e) {
                    reject(e);
                }
            });
            stream.on('error', reject);
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.end();
    });
}
async function tmdbFetch(path) {
    const bearer = process.env.TMDB_BEARER;
    if (!bearer)
        throw new Error('TMDB_BEARER not set');
    const ip = await resolveTmdbIP();
    return httpsRequest(ip, path, bearer);
}
