import { createApp } from './app'
import { connectDB } from './db/connection'
import { env } from './config/env'

async function start() {
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
