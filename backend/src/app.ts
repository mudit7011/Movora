import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './config/env'
import { routes } from './routes'
import { publicRateLimiter } from './middleware/rateLimiter'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }))
  app.use(express.json())
  app.use(cookieParser())
  app.use(publicRateLimiter)
  app.use('/api', routes)

  return app
}
