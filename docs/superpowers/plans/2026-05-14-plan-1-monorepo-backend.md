# Streaming Site — Plan 1: Monorepo Scaffold & Backend API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the monorepo structure and build a fully-tested Express/TypeScript backend API with Movie CRUD, full-text search, and JWT-authenticated admin endpoints.

**Architecture:** npm workspaces monorepo. Backend is a standalone Express app with a testable app factory (no `listen` in tests). Public routes are open + rate-limited. Admin routes require a JWT stored in an `httpOnly` cookie. All inputs validated with Zod.

**Tech Stack:** Node.js 20, Express 4, TypeScript 5, Mongoose 8, Zod 3, jsonwebtoken, bcrypt, cookie-parser, helmet, cors, express-rate-limit, Jest, Supertest, mongodb-memory-server

---

## File Map

```
StreamingSite/
├── package.json                          # workspace root
├── .gitignore
├── .env.example
├── docker-compose.yml                    # local MongoDB + Redis
├── packages/
│   └── shared/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── types/movie.ts            # Movie, Source, RawMovie, CastMember
│           ├── types/admin.ts            # Admin
│           ├── types/scrapeJob.ts        # ScrapeJob
│           └── index.ts                  # barrel export
└── backend/
    ├── package.json
    ├── tsconfig.json
    ├── jest.config.ts
    ├── src/
    │   ├── server.ts                     # entry point (connect DB, listen)
    │   ├── app.ts                        # Express factory (no listen — testable)
    │   ├── config/
    │   │   └── env.ts                    # Zod-validated env vars
    │   ├── db/
    │   │   └── connection.ts             # connectDB / disconnectDB
    │   ├── models/
    │   │   ├── Movie.ts
    │   │   ├── Admin.ts
    │   │   └── ScrapeJob.ts
    │   ├── middleware/
    │   │   ├── authenticate.ts           # JWT httpOnly cookie check
    │   │   └── rateLimiter.ts            # public + login limiters
    │   └── routes/
    │       ├── index.ts                  # mount all routers
    │       ├── movies.ts                 # GET public movie routes
    │       └── admin/
    │           ├── auth.ts               # POST /login, /logout
    │           ├── movies.ts             # CRUD /admin/movies
    │           └── scrape.ts             # POST /trigger, GET /jobs
    ├── scripts/
    │   └── seed-admin.ts                 # create first admin user
    └── tests/
        ├── helpers/
        │   ├── db.ts                     # in-memory MongoDB setup
        │   └── auth.ts                   # generate test JWT
        ├── movies.test.ts
        ├── admin.auth.test.ts
        ├── admin.movies.test.ts
        └── admin.scrape.test.ts
```

---

## Task 1: Monorepo Root Setup

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create root package.json with workspaces**

```json
{
  "name": "streamingsite",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "packages/*",
    "backend"
  ],
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "dev:backend": "npm run dev --workspace=backend",
    "test:backend": "npm run test --workspace=backend",
    "build:backend": "npm run build --workspace=backend"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
dist/
.env
*.env.local
.DS_Store
coverage/
```

- [ ] **Step 3: Create .env.example**

```
PORT=3001
MONGODB_URI=mongodb://localhost:27017/streamingsite
JWT_SECRET=replace-with-a-32-char-minimum-secret-here
TMDB_API_KEY=your_tmdb_api_key_here
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

- [ ] **Step 4: Create docker-compose.yml**

```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:7
    ports:
      - '27017:27017'
    volumes:
      - mongo_data:/data/db
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
volumes:
  mongo_data:
```

- [ ] **Step 5: Start local services and verify**

```bash
docker-compose up -d
docker ps
```

Expected: Two containers running — `mongo:7` on port 27017, `redis:7-alpine` on port 6379.

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore .env.example docker-compose.yml
git commit -m "feat: monorepo root scaffold with docker compose"
```

---

## Task 2: Shared TypeScript Types Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types/movie.ts`
- Create: `packages/shared/src/types/admin.ts`
- Create: `packages/shared/src/types/scrapeJob.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create packages/shared/package.json**

```json
{
  "name": "@streamingsite/shared",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create packages/shared/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/shared/src/types/movie.ts**

```typescript
export interface Source {
  serverName: string
  url: string
  type: 'iframe' | 'direct'
  quality: string
  isWorking: boolean
  lastChecked: string
}

export interface CastMember {
  name: string
  character: string
  photo: string
}

export interface Movie {
  _id: string
  tmdbId: string
  title: string
  titleHindi?: string
  slug: string
  type: 'movie'
  language: string[]
  genres: string[]
  releaseYear: number
  rating: number
  runtime: number
  synopsis: string
  posterUrl: string
  backdropUrl: string
  trailerKey?: string
  cast: CastMember[]
  sources: Source[]
  scrapedFrom: string
  createdAt: string
  updatedAt: string
}

export interface RawMovie {
  title: string
  sourceUrl: string
  sourceSite: string
}

export interface PaginatedMovies {
  movies: Movie[]
  total: number
  page: number
  pages: number
}
```

- [ ] **Step 4: Create packages/shared/src/types/admin.ts**

```typescript
export interface Admin {
  _id: string
  email: string
  role: 'superadmin'
}
```

- [ ] **Step 5: Create packages/shared/src/types/scrapeJob.ts**

```typescript
export interface ScrapeJob {
  _id: string
  site: string
  status: 'running' | 'completed' | 'failed'
  moviesFound: number
  errors: string[]
  startedAt: string
  completedAt?: string
}
```

- [ ] **Step 6: Create packages/shared/src/index.ts**

```typescript
export * from './types/movie'
export * from './types/admin'
export * from './types/scrapeJob'
```

- [ ] **Step 7: Install and build**

```bash
cd packages/shared && npm install && npm run build
```

Expected: `dist/` folder created with `.js` and `.d.ts` files.

- [ ] **Step 8: Commit**

```bash
git add packages/
git commit -m "feat: shared TypeScript types package"
```

---

## Task 3: Backend Project Setup

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/jest.config.ts`

- [ ] **Step 1: Create backend/package.json**

```json
{
  "name": "@streamingsite/backend",
  "version": "1.0.0",
  "main": "dist/server.js",
  "scripts": {
    "dev": "nodemon --exec ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest --runInBand",
    "test:watch": "jest --watch --runInBand"
  },
  "dependencies": {
    "@streamingsite/shared": "*",
    "bcrypt": "^5.1.1",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-rate-limit": "^7.3.1",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.4.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/cookie-parser": "^1.4.7",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "mongodb-memory-server": "^10.0.0",
    "nodemon": "^3.1.3",
    "supertest": "^7.0.0",
    "ts-jest": "^29.1.4",
    "ts-node": "^10.9.2",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create backend/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src", "scripts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create backend/jest.config.ts**

```typescript
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/tests/**/*.test.ts'],
}

export default config
```

- [ ] **Step 4: Install backend dependencies**

```bash
cd backend && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/tsconfig.json backend/jest.config.ts
git commit -m "feat: backend project setup with TypeScript and Jest"
```

---

## Task 4: Environment Config & DB Connection

**Files:**
- Create: `backend/src/config/env.ts`
- Create: `backend/src/db/connection.ts`

- [ ] **Step 1: Write failing test for env validation**

Create `backend/tests/config.test.ts`:

```typescript
describe('env config', () => {
  it('throws when MONGODB_URI is missing', () => {
    const original = process.env.MONGODB_URI
    delete process.env.MONGODB_URI
    jest.resetModules()
    expect(() => require('../src/config/env')).toThrow()
    process.env.MONGODB_URI = original
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest tests/config.test.ts -t "throws when MONGODB_URI is missing"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create backend/src/config/env.ts**

```typescript
import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  PORT: z.string().default('3001'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  TMDB_API_KEY: z.string().min(1, 'TMDB_API_KEY is required'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export const env = envSchema.parse(process.env)
```

- [ ] **Step 4: Create backend/src/db/connection.ts**

```typescript
import mongoose from 'mongoose'
import { env } from '../config/env'

export async function connectDB(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI)
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect()
}
```

- [ ] **Step 5: Verify test passes (set required env vars first)**

```bash
cd backend
export MONGODB_URI=mongodb://localhost:27017/test
export JWT_SECRET=test-secret-minimum-32-characters-here
export TMDB_API_KEY=test-key
npx jest tests/config.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/config/ backend/src/db/ backend/tests/config.test.ts
git commit -m "feat: zod env config and mongoose connection helpers"
```

---

## Task 5: Mongoose Models

**Files:**
- Create: `backend/src/models/Movie.ts`
- Create: `backend/src/models/Admin.ts`
- Create: `backend/src/models/ScrapeJob.ts`

- [ ] **Step 1: Create backend/src/models/Movie.ts**

```typescript
import { Schema, model, Document } from 'mongoose'

interface Source {
  serverName: string
  url: string
  type: 'iframe' | 'direct'
  quality: string
  isWorking: boolean
  lastChecked: Date
}

interface CastMember {
  name: string
  character: string
  photo: string
}

export interface IMovie extends Document {
  tmdbId: string
  title: string
  titleHindi?: string
  slug: string
  type: 'movie'
  language: string[]
  genres: string[]
  releaseYear: number
  rating: number
  runtime: number
  synopsis: string
  posterUrl: string
  backdropUrl: string
  trailerKey?: string
  cast: CastMember[]
  sources: Source[]
  scrapedFrom: string
  createdAt: Date
  updatedAt: Date
}

const sourceSchema = new Schema<Source>({
  serverName: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, enum: ['iframe', 'direct'], required: true },
  quality: { type: String, default: 'HD' },
  isWorking: { type: Boolean, default: true },
  lastChecked: { type: Date, default: Date.now },
})

const movieSchema = new Schema<IMovie>(
  {
    tmdbId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    titleHindi: String,
    slug: { type: String, required: true, unique: true },
    type: { type: String, default: 'movie' },
    language: [String],
    genres: [String],
    releaseYear: Number,
    rating: Number,
    runtime: Number,
    synopsis: String,
    posterUrl: String,
    backdropUrl: String,
    trailerKey: String,
    cast: [{ name: String, character: String, photo: String }],
    sources: [sourceSchema],
    scrapedFrom: String,
  },
  { timestamps: true }
)

movieSchema.index({ title: 'text', synopsis: 'text' })
movieSchema.index({ genres: 1 })
movieSchema.index({ language: 1 })
movieSchema.index({ releaseYear: 1 })
movieSchema.index({ rating: -1 })

export const Movie = model<IMovie>('Movie', movieSchema)
```

- [ ] **Step 2: Create backend/src/models/Admin.ts**

```typescript
import { Schema, model, Document } from 'mongoose'

export interface IAdmin extends Document {
  email: string
  passwordHash: string
  role: 'superadmin'
}

const adminSchema = new Schema<IAdmin>({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['superadmin'], default: 'superadmin' },
})

export const Admin = model<IAdmin>('Admin', adminSchema)
```

- [ ] **Step 3: Create backend/src/models/ScrapeJob.ts**

```typescript
import { Schema, model, Document } from 'mongoose'

export interface IScrapeJob extends Document {
  site: string
  status: 'running' | 'completed' | 'failed'
  moviesFound: number
  errors: string[]
  startedAt: Date
  completedAt?: Date
}

const scrapeJobSchema = new Schema<IScrapeJob>({
  site: { type: String, required: true },
  status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
  moviesFound: { type: Number, default: 0 },
  errors: [String],
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
})

export const ScrapeJob = model<IScrapeJob>('ScrapeJob', scrapeJobSchema)
```

- [ ] **Step 4: Write and run model smoke test**

Create `backend/tests/models.test.ts`:

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Movie } from '../src/models/Movie'
import { Admin } from '../src/models/Admin'
import { ScrapeJob } from '../src/models/ScrapeJob'

let mongo: MongoMemoryServer

beforeAll(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongo.stop()
})

it('creates a Movie document', async () => {
  const movie = await Movie.create({
    tmdbId: '12345',
    title: 'Test Movie',
    slug: 'test-movie-2024',
    type: 'movie',
    language: ['Hindi'],
    genres: ['Action'],
    releaseYear: 2024,
    rating: 7.5,
    runtime: 120,
    synopsis: 'A test movie.',
    posterUrl: 'https://image.tmdb.org/poster.jpg',
    backdropUrl: 'https://image.tmdb.org/backdrop.jpg',
    cast: [],
    sources: [],
    scrapedFrom: 'streamvaults.ru',
  })
  expect(movie.tmdbId).toBe('12345')
  expect(movie.slug).toBe('test-movie-2024')
})

it('creates an Admin document', async () => {
  const admin = await Admin.create({
    email: 'admin@test.com',
    passwordHash: 'hashed',
    role: 'superadmin',
  })
  expect(admin.email).toBe('admin@test.com')
})

it('creates a ScrapeJob document', async () => {
  const job = await ScrapeJob.create({ site: 'streamvaults.ru' })
  expect(job.status).toBe('running')
  expect(job.moviesFound).toBe(0)
})
```

```bash
cd backend && npx jest tests/models.test.ts
```

Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/ backend/tests/models.test.ts
git commit -m "feat: mongoose models for Movie, Admin, and ScrapeJob"
```

---

## Task 6: Express App Factory & Middleware

**Files:**
- Create: `backend/src/middleware/rateLimiter.ts`
- Create: `backend/src/middleware/authenticate.ts`
- Create: `backend/src/routes/index.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/server.ts`
- Create: `backend/tests/helpers/db.ts`
- Create: `backend/tests/helpers/auth.ts`

- [ ] **Step 1: Create backend/src/middleware/rateLimiter.ts**

```typescript
import rateLimit from 'express-rate-limit'

export const publicRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
})

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
})
```

- [ ] **Step 2: Create backend/src/middleware/authenticate.ts**

```typescript
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'

export interface AuthRequest extends Request {
  adminId?: string
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const token: string | undefined =
    req.cookies?.token ?? (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined)

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { adminId: string }
    req.adminId = payload.adminId
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
```

- [ ] **Step 3: Create placeholder routes/index.ts (will be filled in later tasks)**

```typescript
import { Router } from 'express'

const router = Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

export { router as routes }
```

- [ ] **Step 4: Create backend/src/app.ts**

```typescript
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './config/env'
import { routes } from './routes'
import { publicRateLimiter } from './middleware/rateLimiter'

export function createApp() {
  const app = express()

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
```

- [ ] **Step 5: Create backend/src/server.ts**

```typescript
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
```

- [ ] **Step 6: Create backend/tests/helpers/db.ts**

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

let mongoServer: MongoMemoryServer

export async function setupTestDB(): Promise<void> {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
}

export async function teardownTestDB(): Promise<void> {
  await mongoose.disconnect()
  await mongoServer.stop()
}

export async function clearTestDB(): Promise<void> {
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key].deleteMany({})
  }
}
```

- [ ] **Step 7: Create backend/tests/helpers/auth.ts**

```typescript
import jwt from 'jsonwebtoken'

const TEST_SECRET = 'test-secret-minimum-32-characters-here!!'

export function generateTestToken(adminId = 'test-admin-id-000000000000'): string {
  return jwt.sign({ adminId }, process.env.JWT_SECRET ?? TEST_SECRET, { expiresIn: '1h' })
}
```

- [ ] **Step 8: Write and run health check test**

Create `backend/tests/health.test.ts`:

```typescript
import request from 'supertest'
import { createApp } from '../src/app'

process.env.MONGODB_URI = 'mongodb://localhost:27017/test'
process.env.JWT_SECRET = 'test-secret-minimum-32-characters-here!!'
process.env.TMDB_API_KEY = 'test-key'

const app = createApp()

it('GET /api/health returns 200', async () => {
  const res = await request(app).get('/api/health')
  expect(res.status).toBe(200)
  expect(res.body.status).toBe('ok')
})
```

```bash
cd backend && npx jest tests/health.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/src/ backend/tests/helpers/ backend/tests/health.test.ts
git commit -m "feat: Express app factory with helmet, cors, rate limiting, JWT middleware"
```

---

## Task 7: Public Movies Routes

**Files:**
- Create: `backend/src/routes/movies.ts`
- Modify: `backend/src/routes/index.ts`
- Create: `backend/tests/movies.test.ts`

- [ ] **Step 1: Write failing tests for movies routes**

Create `backend/tests/movies.test.ts`:

```typescript
import request from 'supertest'
import { createApp } from '../src/app'
import { Movie } from '../src/models/Movie'
import { setupTestDB, teardownTestDB, clearTestDB } from './helpers/db'

process.env.MONGODB_URI = 'mongodb://localhost:27017/test'
process.env.JWT_SECRET = 'test-secret-minimum-32-characters-here!!'
process.env.TMDB_API_KEY = 'test-key'

const app = createApp()

beforeAll(() => setupTestDB())
afterAll(() => teardownTestDB())
beforeEach(() => clearTestDB())

const movieFixture = {
  tmdbId: '111',
  title: 'Pushpa The Rise',
  slug: 'pushpa-the-rise-2021',
  type: 'movie' as const,
  language: ['Hindi', 'Hindi Dubbed'],
  genres: ['Action'],
  releaseYear: 2021,
  rating: 7.6,
  runtime: 179,
  synopsis: 'A laborer rises through the ranks of a red sandalwood smuggling syndicate.',
  posterUrl: 'https://image.tmdb.org/poster.jpg',
  backdropUrl: 'https://image.tmdb.org/backdrop.jpg',
  cast: [],
  sources: [{ serverName: 'Server 1', url: 'https://embed.host/abc', type: 'iframe' as const, quality: '1080p', isWorking: true }],
  scrapedFrom: 'streamvaults.ru',
}

describe('GET /api/movies', () => {
  it('returns paginated movies', async () => {
    await Movie.create(movieFixture)
    const res = await request(app).get('/api/movies')
    expect(res.status).toBe(200)
    expect(res.body.movies).toHaveLength(1)
    expect(res.body.total).toBe(1)
    expect(res.body.movies[0].sources).toBeUndefined()
  })

  it('filters by language', async () => {
    await Movie.create(movieFixture)
    await Movie.create({ ...movieFixture, tmdbId: '222', slug: 'english-movie', language: ['English'], title: 'English Movie' })
    const res = await request(app).get('/api/movies?language=Hindi Dubbed')
    expect(res.body.movies).toHaveLength(1)
    expect(res.body.movies[0].title).toBe('Pushpa The Rise')
  })
})

describe('GET /api/movies/trending', () => {
  it('returns top movies by rating', async () => {
    await Movie.create(movieFixture)
    const res = await request(app).get('/api/movies/trending')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('GET /api/movies/latest', () => {
  it('returns recently added movies', async () => {
    await Movie.create(movieFixture)
    const res = await request(app).get('/api/movies/latest')
    expect(res.status).toBe(200)
    expect(res.body[0].title).toBe('Pushpa The Rise')
  })
})

describe('GET /api/movies/search', () => {
  it('returns movies matching query', async () => {
    await Movie.create(movieFixture)
    const res = await request(app).get('/api/movies/search?q=Pushpa')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('returns empty array with no query', async () => {
    const res = await request(app).get('/api/movies/search')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('GET /api/movies/:slug', () => {
  it('returns movie with sources by slug', async () => {
    await Movie.create(movieFixture)
    const res = await request(app).get('/api/movies/pushpa-the-rise-2021')
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Pushpa The Rise')
    expect(res.body.sources).toHaveLength(1)
  })

  it('returns 404 for unknown slug', async () => {
    const res = await request(app).get('/api/movies/does-not-exist')
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest tests/movies.test.ts
```

Expected: FAIL — routes not defined yet.

- [ ] **Step 3: Create backend/src/routes/movies.ts**

```typescript
import { Router } from 'express'
import { Movie } from '../models/Movie'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { page = '1', limit = '20', genre, year, language, minRating } = req.query
    const filter: Record<string, unknown> = {}

    if (genre && typeof genre === 'string') filter.genres = genre
    if (year) filter.releaseYear = Number(year)
    if (language && typeof language === 'string') filter.language = language
    if (minRating) filter.rating = { $gte: Number(minRating) }

    const skip = (Number(page) - 1) * Number(limit)
    const [movies, total] = await Promise.all([
      Movie.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).select('-sources'),
      Movie.countDocuments(filter),
    ])

    res.json({ movies, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/trending', async (_req, res) => {
  try {
    const movies = await Movie.find({ rating: { $gte: 6 } })
      .sort({ rating: -1, createdAt: -1 })
      .limit(10)
      .select('-sources')
    res.json(movies)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/latest', async (_req, res) => {
  try {
    const movies = await Movie.find().sort({ createdAt: -1 }).limit(10).select('-sources')
    res.json(movies)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/search', async (req, res) => {
  try {
    const { q } = req.query
    if (!q || typeof q !== 'string') return res.json([])

    const movies = await Movie.find(
      { $text: { $search: q } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(20)
      .select('-sources')

    res.json(movies)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/:slug', async (req, res) => {
  try {
    const movie = await Movie.findOne({ slug: req.params.slug })
    if (!movie) return res.status(404).json({ error: 'Movie not found' })
    res.json(movie)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

export { router as moviesRouter }
```

- [ ] **Step 4: Update backend/src/routes/index.ts to mount movies router**

```typescript
import { Router } from 'express'
import { moviesRouter } from './movies'

const router = Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

router.use('/movies', moviesRouter)

export { router as routes }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && npx jest tests/movies.test.ts
```

Expected: PASS — all tests green.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/movies.ts backend/src/routes/index.ts backend/tests/movies.test.ts
git commit -m "feat: public movies API with pagination, filters, search, and slug lookup"
```

---

## Task 8: Admin Auth Routes

**Files:**
- Create: `backend/src/routes/admin/auth.ts`
- Modify: `backend/src/routes/index.ts`
- Create: `backend/tests/admin.auth.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/admin.auth.test.ts`:

```typescript
import request from 'supertest'
import bcrypt from 'bcrypt'
import { createApp } from '../src/app'
import { Admin } from '../src/models/Admin'
import { setupTestDB, teardownTestDB, clearTestDB } from './helpers/db'

process.env.MONGODB_URI = 'mongodb://localhost:27017/test'
process.env.JWT_SECRET = 'test-secret-minimum-32-characters-here!!'
process.env.TMDB_API_KEY = 'test-key'

const app = createApp()

beforeAll(() => setupTestDB())
afterAll(() => teardownTestDB())
beforeEach(async () => {
  await clearTestDB()
  await Admin.create({
    email: 'admin@test.com',
    passwordHash: await bcrypt.hash('password123', 12),
    role: 'superadmin',
  })
})

describe('POST /api/admin/auth/login', () => {
  it('returns 200 and sets cookie with valid credentials', async () => {
    const res = await request(app).post('/api/admin/auth/login').send({ email: 'admin@test.com', password: 'password123' })
    expect(res.status).toBe(200)
    expect(res.headers['set-cookie']).toBeDefined()
    expect(res.body.message).toBe('Logged in')
  })

  it('returns 401 with wrong password', async () => {
    const res = await request(app).post('/api/admin/auth/login').send({ email: 'admin@test.com', password: 'wrong' })
    expect(res.status).toBe(401)
  })

  it('returns 401 with unknown email', async () => {
    const res = await request(app).post('/api/admin/auth/login').send({ email: 'nobody@test.com', password: 'password123' })
    expect(res.status).toBe(401)
  })

  it('returns 400 with invalid email format', async () => {
    const res = await request(app).post('/api/admin/auth/login').send({ email: 'not-an-email', password: 'password123' })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/admin/auth/logout', () => {
  it('clears cookie and returns 200', async () => {
    const res = await request(app).post('/api/admin/auth/logout')
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Logged out')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest tests/admin.auth.test.ts
```

Expected: FAIL — routes not defined.

- [ ] **Step 3: Create backend/src/routes/admin/auth.ts**

```typescript
import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { Admin } from '../../models/Admin'
import { env } from '../../config/env'
import { loginRateLimiter } from '../../middleware/rateLimiter'

const router = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

router.post('/login', loginRateLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }

  const { email, password } = parsed.data
  const admin = await Admin.findOne({ email: email.toLowerCase() })
  if (!admin) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const valid = await bcrypt.compare(password, admin.passwordHash)
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const token = jwt.sign({ adminId: admin._id.toString() }, env.JWT_SECRET, { expiresIn: '24h' })

  res.cookie('token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
  })

  res.json({ message: 'Logged in' })
})

router.post('/logout', (_req, res) => {
  res.clearCookie('token')
  res.json({ message: 'Logged out' })
})

export { router as adminAuthRouter }
```

- [ ] **Step 4: Update backend/src/routes/index.ts**

```typescript
import { Router } from 'express'
import { moviesRouter } from './movies'
import { adminAuthRouter } from './admin/auth'

const router = Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

router.use('/movies', moviesRouter)
router.use('/admin/auth', adminAuthRouter)

export { router as routes }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && npx jest tests/admin.auth.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/admin/auth.ts backend/src/routes/index.ts backend/tests/admin.auth.test.ts
git commit -m "feat: admin JWT auth with login/logout and httpOnly cookie"
```

---

## Task 9: Admin Movies Routes

**Files:**
- Create: `backend/src/routes/admin/movies.ts`
- Modify: `backend/src/routes/index.ts`
- Create: `backend/tests/admin.movies.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/admin.movies.test.ts`:

```typescript
import request from 'supertest'
import { createApp } from '../src/app'
import { Movie } from '../src/models/Movie'
import { setupTestDB, teardownTestDB, clearTestDB } from './helpers/db'
import { generateTestToken } from './helpers/auth'

process.env.MONGODB_URI = 'mongodb://localhost:27017/test'
process.env.JWT_SECRET = 'test-secret-minimum-32-characters-here!!'
process.env.TMDB_API_KEY = 'test-key'

const app = createApp()
const token = generateTestToken()

beforeAll(() => setupTestDB())
afterAll(() => teardownTestDB())
beforeEach(() => clearTestDB())

const moviePayload = {
  tmdbId: '999',
  title: 'Test Movie',
  slug: 'test-movie-2024',
  language: ['Hindi'],
  genres: ['Drama'],
  releaseYear: 2024,
  rating: 8.0,
  runtime: 140,
  synopsis: 'Synopsis here.',
  posterUrl: 'https://image.tmdb.org/poster.jpg',
  backdropUrl: 'https://image.tmdb.org/backdrop.jpg',
  cast: [],
  sources: [],
  scrapedFrom: 'manual',
}

describe('Admin movies routes — auth guard', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/admin/movies')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/admin/movies', () => {
  it('returns all movies with sources for admin', async () => {
    await Movie.create({ ...moviePayload, sources: [{ serverName: 'S1', url: 'https://embed.host/x', type: 'iframe', quality: 'HD', isWorking: true }] })
    const res = await request(app).get('/api/admin/movies').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body[0].sources).toHaveLength(1)
  })
})

describe('POST /api/admin/movies', () => {
  it('creates a movie', async () => {
    const res = await request(app).post('/api/admin/movies').set('Authorization', `Bearer ${token}`).send(moviePayload)
    expect(res.status).toBe(201)
    expect(res.body.title).toBe('Test Movie')
  })

  it('returns 400 with invalid data', async () => {
    const res = await request(app).post('/api/admin/movies').set('Authorization', `Bearer ${token}`).send({ title: 'incomplete' })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/admin/movies/:id', () => {
  it('updates a movie field', async () => {
    const movie = await Movie.create(moviePayload)
    const res = await request(app)
      .patch(`/api/admin/movies/${movie._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 9.0 })
    expect(res.status).toBe(200)
    expect(res.body.rating).toBe(9.0)
  })

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .patch('/api/admin/movies/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 9.0 })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/admin/movies/:id', () => {
  it('deletes a movie', async () => {
    const movie = await Movie.create(moviePayload)
    const res = await request(app).delete(`/api/admin/movies/${movie._id}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const deleted = await Movie.findById(movie._id)
    expect(deleted).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest tests/admin.movies.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create backend/src/routes/admin/movies.ts**

```typescript
import { Router } from 'express'
import { z } from 'zod'
import { Movie } from '../../models/Movie'
import { authenticate } from '../../middleware/authenticate'

const router = Router()
router.use(authenticate)

const sourceSchema = z.object({
  serverName: z.string(),
  url: z.string().url(),
  type: z.enum(['iframe', 'direct']),
  quality: z.string().default('HD'),
  isWorking: z.boolean().default(true),
})

const movieSchema = z.object({
  tmdbId: z.string(),
  title: z.string(),
  titleHindi: z.string().optional(),
  slug: z.string(),
  language: z.array(z.string()),
  genres: z.array(z.string()),
  releaseYear: z.number(),
  rating: z.number(),
  runtime: z.number(),
  synopsis: z.string(),
  posterUrl: z.string().url(),
  backdropUrl: z.string().url(),
  trailerKey: z.string().optional(),
  cast: z.array(z.object({ name: z.string(), character: z.string(), photo: z.string() })),
  sources: z.array(sourceSchema),
  scrapedFrom: z.string(),
})

router.get('/', async (_req, res) => {
  try {
    const movies = await Movie.find().sort({ createdAt: -1 })
    res.json(movies)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/', async (req, res) => {
  const parsed = movieSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues })
    return
  }
  try {
    const movie = await Movie.create(parsed.data)
    res.status(201).json(movie)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.patch('/:id', async (req, res) => {
  const parsed = movieSchema.partial().safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues })
    return
  }
  try {
    const movie = await Movie.findByIdAndUpdate(req.params.id, parsed.data, { new: true })
    if (!movie) {
      res.status(404).json({ error: 'Movie not found' })
      return
    }
    res.json(movie)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const movie = await Movie.findByIdAndDelete(req.params.id)
    if (!movie) {
      res.status(404).json({ error: 'Movie not found' })
      return
    }
    res.json({ message: 'Deleted' })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

export { router as adminMoviesRouter }
```

- [ ] **Step 4: Update backend/src/routes/index.ts**

```typescript
import { Router } from 'express'
import { moviesRouter } from './movies'
import { adminAuthRouter } from './admin/auth'
import { adminMoviesRouter } from './admin/movies'

const router = Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

router.use('/movies', moviesRouter)
router.use('/admin/auth', adminAuthRouter)
router.use('/admin/movies', adminMoviesRouter)

export { router as routes }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && npx jest tests/admin.movies.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/admin/movies.ts backend/src/routes/index.ts backend/tests/admin.movies.test.ts
git commit -m "feat: admin movie CRUD routes with JWT auth and Zod validation"
```

---

## Task 10: Admin Scrape Routes

**Files:**
- Create: `backend/src/routes/admin/scrape.ts`
- Modify: `backend/src/routes/index.ts`
- Create: `backend/tests/admin.scrape.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/admin.scrape.test.ts`:

```typescript
import request from 'supertest'
import { createApp } from '../src/app'
import { ScrapeJob } from '../src/models/ScrapeJob'
import { setupTestDB, teardownTestDB, clearTestDB } from './helpers/db'
import { generateTestToken } from './helpers/auth'

process.env.MONGODB_URI = 'mongodb://localhost:27017/test'
process.env.JWT_SECRET = 'test-secret-minimum-32-characters-here!!'
process.env.TMDB_API_KEY = 'test-key'

const app = createApp()
const token = generateTestToken()

beforeAll(() => setupTestDB())
afterAll(() => teardownTestDB())
beforeEach(() => clearTestDB())

describe('POST /api/admin/scrape/trigger', () => {
  it('creates a scrape job and returns 202', async () => {
    const res = await request(app).post('/api/admin/scrape/trigger').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(202)
    expect(res.body.jobId).toBeDefined()
    expect(res.body.message).toBe('Scrape job queued')
    const job = await ScrapeJob.findById(res.body.jobId)
    expect(job?.status).toBe('running')
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/admin/scrape/trigger')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/admin/scrape/jobs', () => {
  it('returns list of scrape jobs', async () => {
    await ScrapeJob.create({ site: 'streamvaults.ru', status: 'completed', moviesFound: 10, errors: [] })
    const res = await request(app).get('/api/admin/scrape/jobs').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].moviesFound).toBe(10)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest tests/admin.scrape.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create backend/src/routes/admin/scrape.ts**

```typescript
import { Router } from 'express'
import { ScrapeJob } from '../../models/ScrapeJob'
import { authenticate } from '../../middleware/authenticate'

const router = Router()
router.use(authenticate)

router.post('/trigger', async (_req, res) => {
  try {
    const job = await ScrapeJob.create({ site: 'manual', status: 'running', startedAt: new Date() })
    res.status(202).json({ jobId: job._id, message: 'Scrape job queued' })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/jobs', async (_req, res) => {
  try {
    const jobs = await ScrapeJob.find().sort({ startedAt: -1 }).limit(20)
    res.json(jobs)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

export { router as adminScrapeRouter }
```

- [ ] **Step 4: Update backend/src/routes/index.ts (final version)**

```typescript
import { Router } from 'express'
import { moviesRouter } from './movies'
import { adminAuthRouter } from './admin/auth'
import { adminMoviesRouter } from './admin/movies'
import { adminScrapeRouter } from './admin/scrape'

const router = Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

router.use('/movies', moviesRouter)
router.use('/admin/auth', adminAuthRouter)
router.use('/admin/movies', adminMoviesRouter)
router.use('/admin/scrape', adminScrapeRouter)

export { router as routes }
```

- [ ] **Step 5: Run all tests**

```bash
cd backend && npx jest
```

Expected: ALL PASS — models, health, movies, admin auth, admin movies, admin scrape.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/admin/scrape.ts backend/src/routes/index.ts backend/tests/admin.scrape.test.ts
git commit -m "feat: admin scrape trigger and job history routes"
```

---

## Task 11: Admin Seed Script

**Files:**
- Create: `backend/scripts/seed-admin.ts`

- [ ] **Step 1: Create backend/scripts/seed-admin.ts**

```typescript
import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import bcrypt from 'bcrypt'
import { Admin } from '../src/models/Admin'
import { env } from '../src/config/env'

async function seedAdmin() {
  await mongoose.connect(env.MONGODB_URI)

  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD env vars before running this script.')
    process.exit(1)
  }

  const existing = await Admin.findOne({ email })
  if (existing) {
    console.log(`Admin ${email} already exists.`)
    await mongoose.disconnect()
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await Admin.create({ email, passwordHash, role: 'superadmin' })
  console.log(`Admin created: ${email}`)
  await mongoose.disconnect()
}

seedAdmin().catch(console.error)
```

- [ ] **Step 2: Run seed script to create your admin user**

```bash
cd backend
ADMIN_EMAIL=muditkumar7011@gmail.com ADMIN_PASSWORD=your-strong-password npx ts-node scripts/seed-admin.ts
```

Expected: `Admin created: muditkumar7011@gmail.com`

- [ ] **Step 3: Verify admin exists in MongoDB**

```bash
docker exec -it $(docker ps -qf "ancestor=mongo:7") mongosh streamingsite --eval "db.admins.find().pretty()"
```

Expected: One document with your email and a bcrypt hash.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/seed-admin.ts
git commit -m "feat: admin seed script for initial superadmin creation"
```

---

## Task 12: Full Test Run & Dev Server Smoke Test

- [ ] **Step 1: Run the full test suite**

```bash
cd backend && npx jest --coverage
```

Expected: All tests pass. Coverage report generated.

- [ ] **Step 2: Start dev server and hit /health**

```bash
# In one terminal — ensure docker-compose is running
docker-compose up -d

# In another terminal
cd backend && npm run dev
```

```bash
curl http://localhost:3001/api/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 3: Test movies endpoint with seed data (optional)**

```bash
curl "http://localhost:3001/api/movies/trending"
```

Expected: `[]` (empty — no data seeded yet, scraper runs in Plan 2).

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "chore: verified full backend test suite and dev server smoke test"
```

---

## What's Next

- **Plan 2** — Scraper engine (Python + Playwright + TMDB client + streamvaults.ru adapter)
- **Plan 3** — Frontend public pages (Next.js 14, TailwindCSS, Framer Motion, Crimson Gold theme)
- **Plan 4** — Watch page (Video.js + HLS.js) + Admin panel
- **Plan 5** — Deployment (Vercel + Render + GitHub Actions + Cloudflare)
