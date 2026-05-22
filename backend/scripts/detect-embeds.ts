/**
 * Detects embed/player URLs from any streaming site.
 * Opens a REAL browser — you navigate manually, click Play, then press Enter in terminal.
 *
 * Run: npx ts-node --transpile-only scripts/detect-embeds.ts https://movie-box.co/
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const { chromium } = require('playwright-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const readline = require('readline')
chromium.use(StealthPlugin())

const TARGET_URL = process.argv[2] || 'https://net22.cc/home'

// Noise to filter out — not video related
const SKIP_PATTERNS = [
  /google|gstatic|googleapis|doubleclick|facebook|twitter|analytics|gtag|cdn\.jsdelivr|cloudflare|recaptcha/i,
  /\.(css|woff2?|ttf|eot|ico|png|jpg|jpeg|gif|svg|webp)(\?|$)/i,
]

function waitForEnter(msg: string): Promise<void> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(msg, () => { rl.close(); resolve() })
  })
}

async function main() {
  console.log(`\n🔍 Opening browser for: ${TARGET_URL}`)
  console.log('━'.repeat(60))

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: null,
  })
  const page = await context.newPage()

  // Track ALL pages/frames opened (player sites open in new tabs or frames)
  const allRequests = new Set<string>()
  const allFrameUrls = new Set<string>()

  context.on('page', (newPage: any) => {
    console.log(`  🪟 New tab opened: ${newPage.url()}`)
    newPage.on('request', (req: any) => {
      const url: string = req.url()
      if (!SKIP_PATTERNS.some(p => p.test(url))) allRequests.add(url)
    })
    newPage.on('framenavigated', (frame: any) => {
      const url: string = frame.url()
      if (url && url !== 'about:blank' && !SKIP_PATTERNS.some(p => p.test(url)))
        allFrameUrls.add(url)
    })
  })

  page.on('request', (req: any) => {
    const url: string = req.url()
    if (!SKIP_PATTERNS.some(p => p.test(url))) allRequests.add(url)
  })

  page.on('framenavigated', (frame: any) => {
    const url: string = frame.url()
    if (url && url !== 'about:blank' && !SKIP_PATTERNS.some(p => p.test(url)))
      allFrameUrls.add(url)
  })

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})

  console.log('\n📋 INSTRUCTIONS:')
  console.log('  1. Solve any Cloudflare challenge in the browser')
  console.log('  2. Click on any movie or TV show')
  console.log('  3. Click the PLAY button — wait for player to fully load (5-10 sec)')
  console.log('  4. Come back here and press ENTER\n')

  await waitForEnter('  ▶  Press ENTER when the player is loaded...')

  // Grab ALL iframes from every frame in the page
  const iframes: string[] = []
  for (const frame of page.frames()) {
    try {
      const srcs: string[] = await frame.evaluate(() =>
        Array.from(document.querySelectorAll('iframe')).map((el: any) => el.src || el.getAttribute('data-src') || '')
      )
      iframes.push(...srcs.filter(Boolean))
      allFrameUrls.add(frame.url())
    } catch { /* frame may have navigated away */ }
  }

  await browser.close()

  console.log('\n' + '━'.repeat(60))
  console.log('🖼  ALL IFRAMES FOUND IN DOM:')
  if (iframes.length) iframes.forEach(u => console.log(`  ${u}`))
  else console.log('  (none)')

  console.log('\n🌐 ALL FRAME/NAVIGATION URLS:')
  const frameList = [...allFrameUrls].filter(u => !u.startsWith('http://localhost') && u !== TARGET_URL)
  if (frameList.length) frameList.forEach(u => console.log(`  ${u}`))
  else console.log('  (none)')

  console.log('\n📡 ALL NETWORK REQUESTS (filtered):')
  const reqList = [...allRequests].filter(u =>
    !u.startsWith(TARGET_URL.split('/').slice(0, 3).join('/'))
  )
  if (reqList.length) reqList.slice(0, 40).forEach(u => console.log(`  ${u}`))
  else console.log('  (none)')

  console.log('\n' + '━'.repeat(60))
  console.log('📋 Share the iframe/frame URLs above — look for the video player domain!')
}

main().catch(console.error)
