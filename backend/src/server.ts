import { execSync } from 'child_process'
import { createApp } from './app'
import { connectDB } from './db/connection'
import { env } from './config/env'

function ensureChromium() {
  try {
    execSync('npx playwright install chromium', { stdio: 'inherit' })
  } catch (e) {
    console.warn('[Playwright] Browser install failed, scraper may not work:', e)
  }
}

async function start() {
  ensureChromium()
  await connectDB()
  const app = createApp()
  app.listen(Number(env.PORT), () => {
    console.log(`Backend running on http://localhost:${env.PORT}`)
  })
}

start().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
