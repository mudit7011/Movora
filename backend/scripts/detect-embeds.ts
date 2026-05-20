/**
 * Detects embed/player URLs from any streaming site.
 * Opens a REAL browser — you navigate manually, click Play, then press Enter in terminal.
 *
 * Run: npx ts-node --transpile-only scripts/detect-embeds.ts https://net22.cc/home
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const { chromium } = require('playwright-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const readline = require('readline')
chromium.use(StealthPlugin())

const TARGET_URL = process.argv[2] || 'https://net22.cc/home'

const VIDEO_PATTERNS = [
  /\/embed\//i, /\/player\//i, /\/stream\//i,
  /vidsrc/i, /2embed/i, /vidlink/i, /autoembed/i,
  /multiembed/i, /embed\.su/i, /videasy/i,
  /\.m3u8/i, /streamtape/i, /doodstream/i,
  /mixdrop/i, /filemoon/i, /streamlare/i,
  /rabbitstream/i, /upcloud/i, /megacloud/i,
  /moonplayer/i, /gogoplay/i, /playm4u/i,
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
    viewport: null, // use full window
  })
  const page = await context.newPage()
  const captured = new Set<string>()

  page.on('request', (req: any) => {
    const url: string = req.url()
    if (VIDEO_PATTERNS.some(p => p.test(url)) && !captured.has(url)) {
      captured.add(url)
      console.log(`  ✅ ${url}`)
    }
  })

  page.on('response', (res: any) => {
    const url: string = res.url()
    if (VIDEO_PATTERNS.some(p => p.test(url)) && !captured.has(url)) {
      captured.add(url)
      console.log(`  ✅ ${url}`)
    }
  })

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})

  console.log('\n📋 INSTRUCTIONS:')
  console.log('  1. In the browser that just opened, solve any Cloudflare challenge')
  console.log('  2. Click on any movie or TV show')
  console.log('  3. Click the PLAY button to load the video player')
  console.log('  4. Wait for the player to fully load')
  console.log('  5. Come back here and press ENTER\n')

  await waitForEnter('  ▶  Press ENTER when the player is loaded...')

  // Grab iframes from current DOM state
  const iframes: string[] = await page.evaluate(() =>
    Array.from(document.querySelectorAll('iframe[src]')).map((el: any) => el.src)
  ).catch(() => [])

  iframes.forEach(src => {
    if (!captured.has(src)) {
      captured.add(src)
      console.log(`  🖼  IFRAME: ${src}`)
    }
  })

  await browser.close()

  const results = [...captured]
  console.log(`\n${'━'.repeat(60)}`)
  console.log(`📊 Found ${results.length} embed URL(s):`)
  results.forEach((u, i) => console.log(`  ${i + 1}. ${u}`))

  if (results.length === 0) {
    console.log('\n  ⚠️  Nothing captured.')
    console.log('  Try: Chrome → DevTools (Cmd+Option+I) → Network tab → filter "embed"')
    console.log('  Then manually report the iframe src URL here.')
  } else {
    console.log('\n✅ Copy the embed domain(s) above and share them — we\'ll add as new servers!')
  }
}

main().catch(console.error)
