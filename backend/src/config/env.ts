import dotenv from 'dotenv'
import path from 'path'
import { z } from 'zod'

// In test mode the runner injects env vars directly; skip file loading so that
// tests that deliberately delete a var (to test validation) still throw.
if (process.env.NODE_ENV !== 'test') {
  // Load .env from project root (one level above backend/), then fall back to cwd.
  // Never override vars that are already set (e.g. CI secrets).
  dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: false })
  dotenv.config({ override: false }) // fallback: cwd .env
}

const envSchema = z.object({
  PORT: z.string().default('3001'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  TMDB_API_KEY: z.string().min(1, 'TMDB_API_KEY is required'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export const env = envSchema.parse(process.env)
