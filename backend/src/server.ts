import { createApp } from './app'
import { connectDB } from './db/connection'
import { env } from './config/env'
import { Movie } from './models/Movie'

async function start() {
  await connectDB()
  const app = createApp()
  app.listen(Number(env.PORT), () => {
    console.log(`Backend running on http://localhost:${env.PORT}`)
  })
  // Force-build DB indexes (browse-query perf). Runs in background so startup
  // isn't blocked; logs the result to Render so we can confirm they built.
  console.log('[indexes] syncing…')
  Movie.syncIndexes()
    .then(() => console.log('[indexes] synced OK'))
    .catch((e) => console.error('[indexes] sync FAILED:', e))
}

start().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
