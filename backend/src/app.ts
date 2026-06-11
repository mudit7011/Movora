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
  const allowedOrigins = [
    env.FRONTEND_URL,
    'https://watchmovora.com',
    'https://www.watchmovora.com',
  ].filter(Boolean)
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      // Allow all localhost origins in development
      if (origin.startsWith('http://localhost:')) return cb(null, true)
      if (allowedOrigins.includes(origin)) return cb(null, true)
      cb(new Error('Not allowed by CORS'))
    },
    credentials: true,
  }))
  app.use(express.json())
  app.use(cookieParser())
  app.use(publicRateLimiter)
  app.use('/api', routes)

  return app
}
