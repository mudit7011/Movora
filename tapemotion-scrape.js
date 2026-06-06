// Use playwright-extra with proper stealth plugin for playwright
const { addExtra } = require('playwright-extra');
const { chromium: baseChromium } = require('playwright');

// The puppeteer-extra stealth plugin is compatible with playwright-extra
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

const chromium = addExtra(baseChromium);
chromium.use(StealthPlugin());

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ]
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  // Collect all network requests
  const networkRequests = [];
  page.on('request', req => {
    const url = req.url();
    networkRequests.push({ url, type: req.resourceType(), method: req.method() });
  });

  console.log('Navigating to tapemotion...');
  try {
    await page.goto('https://tapemotion.com/en/watch/687163?project-hail-mary=', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
  } catch(e) {
    console.log('Navigation note:', e.message.substring(0, 200));
  }

  // Wait for Cloudflare challenge to pass and actual page to load
  console.log('Waiting for page to load past Cloudflare...');
  await page.waitForTimeout(15000);

  // Check if we're past Cloudflare
  let titleNow = await page.title();
  console.log('Page title after wait:', titleNow);
  console.log('Current URL:', page.url());

  if (titleNow.includes('Just a moment') || titleNow.includes('Cloudflare')) {
    console.log('Still on Cloudflare challenge page, waiting more...');
    await page.waitForTimeout(20000);
    titleNow = await page.title();
    console.log('Title after extra wait:', titleNow);
  }

  // Take screenshot
  await page.screenshot({ path: '/tmp/tapemotion-screenshot.png', fullPage: false });
  console.log('Screenshot saved to /tmp/tapemotion-screenshot.png');

  // Dump all iframes on page
  const iframes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('iframe')).map(f => ({
      src: f.src,
      dataSrc: f.getAttribute('data-src'),
      dataUrl: f.getAttribute('data-url'),
      id: f.id,
      className: f.className,
    }));
  });
  console.log('\n=== IFRAMES ON PAGE ===');
  console.log(JSON.stringify(iframes, null, 2));

  // Look for server/source elements
  const serverButtons = await page.evaluate(() => {
    const allElements = Array.from(document.querySelectorAll('*'));
    const relevant = allElements.filter(el => {
      const text = el.textContent.trim();
      return (
        text.includes('Server') ||
        text.includes('Source') ||
        text.includes('MovieLand') ||
        text.includes('SuperFlix') ||
        text.includes('FMovies') ||
        text.includes('VidSrc') ||
        text.includes('Nepu') ||
        text.includes('Rido') ||
        text.includes('Prime') ||
        text.includes('Premium')
      ) && el.children.length < 5 && text.length < 200;
    });
    return relevant.slice(0, 50).map(el => ({
      tag: el.tagName,
      text: el.textContent.trim().substring(0, 100),
      className: el.className,
      id: el.id,
      dataAttrs: Object.fromEntries(
        Array.from(el.attributes)
          .filter(a => a.name.startsWith('data-'))
          .map(a => [a.name, a.value])
      ),
      href: el.getAttribute('href') || null,
      onclick: el.getAttribute('onclick') || null,
    }));
  });
  console.log('\n=== SERVER/SOURCE ELEMENTS ===');
  console.log(JSON.stringify(serverButtons, null, 2));

  // Extract __NEXT_DATA__
  const nextData = await page.evaluate(() => {
    const el = document.getElementById('__NEXT_DATA__');
    return el ? el.textContent : null;
  });
  if (nextData) {
    console.log('\n=== __NEXT_DATA__ ===');
    try {
      const data = JSON.parse(nextData);
      console.log(JSON.stringify(data, null, 2).substring(0, 8000));
    } catch(e) {
      console.log(nextData.substring(0, 5000));
    }
  } else {
    console.log('No __NEXT_DATA__ found');
  }

  // Get HTML and search for 687163 and embed URLs
  const html = await page.content();
  const htmlChunks = html.split(/[;\n]/);
  const tmdbHtmlMatches = htmlChunks.filter(l => l.includes('687163')).map(l => l.trim().substring(0, 400));
  console.log('\n=== SECTIONS CONTAINING 687163 IN HTML ===');
  console.log(JSON.stringify(tmdbHtmlMatches, null, 2));

  // Search for embed patterns
  const embedMatches = (html.match(/(https?:\/\/[^\s"'<>\\]+(?:embed|player|stream|iframe|watch)[^\s"'<>\\]*)/gi) || []);
  console.log('\n=== EMBED-LIKE URLs IN HTML ===');
  console.log(JSON.stringify([...new Set(embedMatches)], null, 2));

  // Print relevant network requests
  console.log('\n=== NETWORK REQUESTS (non-static) ===');
  const relevant = networkRequests.filter(r =>
    !r.url.includes('fonts.') &&
    !r.url.includes('.png') &&
    !r.url.includes('.jpg') &&
    !r.url.includes('.css') &&
    !r.url.includes('.woff') &&
    !r.url.includes('.ico') &&
    !r.url.startsWith('blob:')
  );
  for (const r of relevant) {
    console.log(`[${r.type}] ${r.method || 'GET'} ${r.url}`);
  }

  await browser.close();
})();
