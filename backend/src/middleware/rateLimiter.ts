import rateLimit from 'express-rate-limit'
import { Request } from 'express'

const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN

export const publicRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  // Skip rate limiting for internal Vercel SSR calls
  skip: (req: Request) =>
    !!INTERNAL_TOKEN && req.headers['x-internal-token'] === INTERNAL_TOKEN,
})

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
})
