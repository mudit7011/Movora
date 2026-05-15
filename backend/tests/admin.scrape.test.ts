import request from 'supertest'

process.env.MONGODB_URI = 'mongodb://localhost:27017/test'
process.env.JWT_SECRET = 'test-secret-minimum-32-characters-here!!'
process.env.TMDB_API_KEY = 'test-key'

import { createApp } from '../src/app'
import { ScrapeJob } from '../src/models/ScrapeJob'
import { setupTestDB, teardownTestDB, clearTestDB } from './helpers/db'
import { generateTestToken } from './helpers/auth'

const app = createApp()
const token = generateTestToken()

beforeAll(() => setupTestDB(), 60000)
afterAll(() => teardownTestDB(), 30000)
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
    await ScrapeJob.create({ site: 'streamvaults.ru', status: 'completed', moviesFound: 10, scrapeErrors: [] })
    const res = await request(app).get('/api/admin/scrape/jobs').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].moviesFound).toBe(10)
  })
})
