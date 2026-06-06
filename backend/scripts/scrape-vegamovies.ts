/**
 * Vegamovies scraper — extracts actual streaming embed URLs for movies/shows
 * then saves them as sources in MongoDB.
 *
 * Usage:
 *   npx ts-node scripts/scrape-vegamovies.ts --title "Mirzapur" --year 2018
 *   npx ts-node scripts/scrape-vegamovies.ts --batch --limit 20   # scrape all DB movies missing sources
 *
 * Requires: playwright-extra  puppeteer-extra-plugin-stealth
 *   npm install playwright-extra puppeteer-extra-plugin-stealth   (in backend/)
 */

import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { Movie } from '../src/models/Movie'

dotenv.config({ path: path.resolve(__dirname, '../.env') })
chromium.use(StealthPlugin() as any)

// ── Config ────────────────────────────────────────────────────────────────────

// Update this if the domain changes — vegamovies moves around
const BASE = 'https://vegamovies.hair'

const SKIP_HOSTS = [
  'google', 'analytics', 'facebook', 'doubleclick', 'googlesyndication',
  'adsbygoogle', 'amazon-adsystem', 'googletagmanager',
]

// Streaming hosts we want to capture
const STREAM_HOSTS = [
  'filemoon', 'streamwish', 'wishembed', 'doodstream', 'dood.',
  'streamtape', 'vidmoly', 'vidhide', 'streamhide', 'embedrise',
  'uqload', 'upstream', 'supervideo', 'filelions', 'dropload',
  'voe.sx', 'mixdrop', 'turbostream', 'fastclick', 'highstream',
]

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Helpers ───────────────────────────────────────────────────────────────────

function isStreamUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return STREAM_HOSTS.some(h => host.includes(h))
  } catch { return false }
}

function shouldSkip(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return SKIP_HOSTS.some(h => host.includes(h))
  } catch { return true }
}

// ── Core scraper ──────────────────────────────────────────────────────────────

async function scrapeMovie(title: string, year: number): Promise<string[]> {
  const browser = await chromium.launch({ headless: false, slowMo: 100 })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  })
  const foundUrls = new Set<string>()

  // Intercept requests to catch direct stream URLs
  context.on('request', req => {
    const url = req.url()
    if (!shouldSkip(url) && isStreamUrl(url)) {
      console.log('  [STREAM REQ]', url)
      foundUrls.add(url)
    }
  })

  // Catch new pages/tabs opened by stream buttons
  context.on('page', async newPage => {
    const url = newPage.url()
    if (isStreamUrl(url)) {
      console.log('  [NEW TAB]', url)
      foundUrls.add(url)
    }
    newPage.on('framenavigated', frame => {
      const u = frame.url()
      if (isStreamUrl(u)) {
        console.log('  [FRAME NAV]', u)
        foundUrls.add(u)
      }
    })
  })

  const page = await context.newPage()
  page.on('framenavigated', frame => {
    const url = frame.url()
    if (isStreamUrl(url)) {
      console.log('  [FRAME NAV main]', url)
      foundUrls.add(url)
    }
  })

  try {
    // 1. Search
    const searchUrl = `${BASE}/?s=${encodeURIComponent(title + ' ' + year)}`
    console.log(`\nSearching: ${searchUrl}`)
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(3000) // wait for CF challenge

    // 2. Find best matching result
    const links = await page.$$eval('article a, h2 a, .entry-title a', (els: any[]) =>
      els.map(el => ({ text: (el.innerText || el.textContent || '').trim(), href: el.href }))
        .filter(l => l.href && l.href.startsWith('http'))
    )

    const titleLow = title.toLowerCase()
    const yearStr = year.toString()

    let bestLink = links.find(l =>
      l.text.toLowerCase().includes(titleLow) && l.href.includes(yearStr)
    ) || links.find(l =>
      l.text.toLowerCase().includes(titleLow)
    )

    if (!bestLink) {
      console.log('No match found for:', title, year)
      console.log('Available results:', links.slice(0, 5).map(l => l.text))
      await browser.close()
      return []
    }

    console.log(`Found: ${bestLink.text}  →  ${bestLink.href}`)

    // 3. Navigate to movie page
    await page.goto(bestLink.href, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(3000)

    // 4. Find all iframes already on page
    const iframes = await page.$$eval('iframe[src]', (els: any[]) => els.map(el => el.src))
    for (const src of iframes) {
      if (!shouldSkip(src)) {
        console.log('  [IFRAME]', src)
        foundUrls.add(src)
      }
    }

    // 5. Find and click all streaming server buttons
    //    Common selectors on vegamovies-type WordPress themes
    const buttonSelectors = [
      '.wp-block-button a', '.button-link', 'a[href*="watch"]',
      '.serverselect button', '.tab-content button',
      'button[data-src]', 'a[data-src]',
      '.entry-content a[rel="noopener"]',
      '.wp-block-buttons a',
    ]

    for (const sel of buttonSelectors) {
      const buttons = await page.$$(sel)
      if (buttons.length === 0) continue

      console.log(`  Clicking ${buttons.length} button(s) matching "${sel}"`)
      for (const btn of buttons.slice(0, 8)) { // max 8 buttons per selector
        try {
          await btn.click()
          await sleep(2000)

          // Re-check iframes after each click
          const newIframes = await page.$$eval('iframe[src]', (els: any[]) => els.map(el => el.src))
          for (const src of newIframes) {
            if (!shouldSkip(src)) foundUrls.add(src)
          }
        } catch { /* skip unclickable buttons */ }
      }
    }

    // 6. Scroll down in case lazy-loaded content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await sleep(2000)
    const finalIframes = await page.$$eval('iframe[src]', (els: any[]) => els.map(el => el.src))
    for (const src of finalIframes) {
      if (!shouldSkip(src)) foundUrls.add(src)
    }

  } finally {
    await browser.close()
  }

  return [...foundUrls]
}

// ── Server name from URL ──────────────────────────────────────────────────────

function serverLabel(url: string): string {
  const host = (() => { try { return new URL(url).hostname } catch { return url } })()
  if (host.includes('filemoon'))    return 'FileMoon'
  if (host.includes('streamwish') || host.includes('wishembed')) return 'StreamWish'
  if (host.includes('dood'))        return 'DoodStream'
  if (host.includes('streamtape'))  return 'StreamTape'
  if (host.includes('vidmoly'))     return 'Vidmoly'
  if (host.includes('vidhide') || host.includes('streamhide')) return 'VidHide'
  if (host.includes('voe'))         return 'VOE'
  if (host.includes('mixdrop'))     return 'MixDrop'
  return host.split('.')[0]
}

// ── CLI / main ────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const getArg = (flag: string) => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }
  const batchMode = args.includes('--batch')
  const titleArg  = getArg('--title')
  const yearArg   = getArg('--year')
  const limitArg  = Number(getArg('--limit') ?? 10)

  await mongoose.connect(process.env.MONGODB_URI!)

  if (batchMode) {
    // Scrape movies in DB that have empty sources or no streamVerified
    const movies = await Movie.find({
      type: 'movie',
      language: { $in: ['Hindi'] },
      $or: [{ sources: { $size: 0 } }, { streamVerified: false }],
    }).limit(limitArg).select('title releaseYear slug')

    console.log(`Batch mode: ${movies.length} movies to scrape`)
    for (const movie of movies) {
      console.log(`\n═══ ${movie.title} (${movie.releaseYear}) ═══`)
      const urls = await scrapeMovie(movie.title, movie.releaseYear)

      if (urls.length > 0) {
        const sources = urls.map((url, i) => ({
          serverName: serverLabel(url),
          url,
          type: 'iframe' as const,
          quality: 'HD',
          isWorking: true,
        }))
        await Movie.updateOne({ _id: movie._id }, { $set: { sources, streamVerified: true } })
        console.log(`✅ Saved ${sources.length} sources for ${movie.title}`)
      } else {
        console.log(`❌ No sources found for ${movie.title}`)
      }
      await sleep(5000) // polite delay between movies
    }
  } else if (titleArg) {
    const year = Number(yearArg ?? new Date().getFullYear())
    console.log(`Single mode: "${titleArg}" (${year})`)
    const urls = await scrapeMovie(titleArg, year)

    console.log(`\n──── Found ${urls.length} streaming URL(s) ────`)
    urls.forEach((url, i) => console.log(`  ${i + 1}. [${serverLabel(url)}] ${url}`))

    if (urls.length > 0) {
      // Optionally save to DB if slug provided
      const slugArg = getArg('--slug')
      if (slugArg) {
        const sources = urls.map(url => ({
          serverName: serverLabel(url),
          url,
          type: 'iframe' as const,
          quality: 'HD',
          isWorking: true,
        }))
        await Movie.updateOne({ slug: slugArg }, { $set: { sources, streamVerified: true } })
        console.log(`✅ Saved to DB for slug: ${slugArg}`)
      }
    }
  } else {
    console.log(`
Usage:
  npx ts-node scripts/scrape-vegamovies.ts --title "Mirzapur" --year 2018
  npx ts-node scripts/scrape-vegamovies.ts --title "Stree 2" --year 2024 --slug stree-2-2024
  npx ts-node scripts/scrape-vegamovies.ts --batch --limit 10
    `)
  }

  await mongoose.disconnect()
}

main().catch(console.error)
