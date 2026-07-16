import https from 'https'
import zlib from 'zlib'
import { Resolver } from 'dns'

let cachedIP: string | null = null
let cacheTime = 0
const IP_TTL = 5 * 60 * 1000 // refresh resolved IP every 5 minutes

async function resolveTmdbIP(): Promise<string> {
  if (cachedIP && Date.now() - cacheTime < IP_TTL) return cachedIP
  return new Promise((resolve) => {
    const resolver = new Resolver()
    resolver.setServers(['8.8.8.8', '8.8.4.4'])
    const timer = setTimeout(() => {
      // DNS took too long — fall back to hostname and let Node resolve it
      resolve(cachedIP || 'api.themoviedb.org')
    }, 3000)
    resolver.resolve4('api.themoviedb.org', (err, addresses) => {
      clearTimeout(timer)
      if (!err && addresses[0]) {
        cachedIP = addresses[0]
        cacheTime = Date.now()
      }
      resolve(cachedIP || 'api.themoviedb.org')
    })
  })
}
export async function tmdbFetch(path: string): Promise<any> {
  const bearer = process.env.TMDB_BEARER
  if (!bearer) throw new Error('TMDB_BEARER not set')
  const ip = await resolveTmdbIP()
  return new Promise((resolve, reject) => {
    const req = https.request({
      host: ip, port: 443,
      path: `/3${path}`,
      method: 'GET',
      servername: 'api.themoviedb.org',
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: 'application/json',
        Host: 'api.themoviedb.org',
      },
      timeout: 8000,
    }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`TMDB ${res.statusCode}`))
        res.resume()
        return
      }
      const enc = res.headers['content-encoding']
      let stream: NodeJS.ReadableStream = res
      if (enc === 'gzip') stream = res.pipe(zlib.createGunzip())
      else if (enc === 'deflate') stream = res.pipe(zlib.createInflate())
      else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress())
      const chunks: Buffer[] = []
      stream.on('data', (c: Buffer) => chunks.push(c))
      stream.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
        catch (e) { reject(e) }
      })
      stream.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.end()
  })
}
