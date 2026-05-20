/**
 * Detects embed/player URLs from any streaming site using Playwright stealth.
 * Clicks the play/watch button and intercepts network requests.
 *
 * Run: npx ts-node --transpile-only scripts/detect-embeds.ts <url>
 * Example: npx ts-node --transpile-only scripts/detect-embeds.ts https://movie-box.co/detail/off-campus-hindi-wo6t7haj4sa
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const { chromium } = require('playwright-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
chromium.use(StealthPlugin())

const TARGET_URL = process.argv[2] || 'https://movie-box.co/detail/off-campus-hindi-wo6t7haj4sa'

const VIDEO_PATTERNS = [
  /\/embed\//i, /\/player\//i, /\/stream\//i,
  /vidsrc/i, /2embed/i, /vidlink/i, /autoembed/i,
  /multiembed/i, /embed\.su/i, /videasy/i, /vidsrc/i,
  /\.m3u8/i, /\/watch\?/i, /streamtape/i, /doodstream/i,
  /mixdrop/i, /upstream/i, /filemoon/i, /streamlare/i,
]

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log(`\n🔍 Detecting embed servers from: ${TARGET_URL}\n`)

  const browser = await chromium.launch({ headless: false }) // headless:false so you can see it
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  })
  const page = await context.newPage()

  const captured: string[] = []

  // Intercept ALL network requests
  page.on('request', (req: any) => {
    const url = req.url()
    if (VIDEO_PATTERNS.some(p => p.test(url))) {
      if (!captured.includes(url)) {
        captured.push(url)
        console.log(`  ✅ FOUND: ${url}`)
      }
    }
  })

  // Also intercept responses for XHR/fetch calls
  page.on('response', async (res: any) => {
    const url = res.url()
    if (VIDEO_PATTERNS.some(p => p.test(url))) {
      if (!captured.includes(url)) {
        captured.push(url)
        console.log(`  ✅ RESPONSE: ${url}`)
      }
    }
  })

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await sleep(2000)

  // Try clicking common play/watch buttons
  const playSelectors = [
    'button:has-text("Watch")', 'button:has-text("Play")', 'button:has-text("Online")',
    'a:has-text("Watch")', 'a:has-text("Play")',
    '[class*="play"]', '[class*="watch"]', '[class*="btn-play"]',
    '.play-btn', '#play-btn', '.watch-btn',
  ]

  for (const sel of playSelectors) {
    try {
      const btn = await page.$(sel)
      if (btn) {
        console.log(`  👆 Clicking: ${sel}`)
        await btn.click()
        await sleep(3000)
        break
      }
    } catch { /* selector not found */ }
  }

  // Wait a bit more for iframes/requests to load
  await sleep(5000)

  // Also grab all iframe srcs from the DOM
  const iframes = await page.evaluate(() =>
    Array.from(document.querySelectorAll('iframe')).map((el: any) => el.src).filter(Boolean)
  )
  iframes.forEach((src: string) => {
    if (!captured.includes(src)) {
      captured.push(src)
      console.log(`  🖼  IFRAME: ${src}`)
    }
  })

  console.log(`\n📊 Summary — ${captured.length} embed URLs detected:`)
  captured.forEach((u, i) => console.log(`  ${i + 1}. ${u}`))

  if (captured.length === 0) {
    console.log('  ⚠️  None found. Try running with headless:false and manually clicking Play.')
  }

  await browser.close()
}

main().catch(console.error)
