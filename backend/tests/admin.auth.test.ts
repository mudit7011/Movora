import request from 'supertest'

process.env.MONGODB_URI = 'mongodb://localhost:27017/test'
process.env.JWT_SECRET = 'test-secret-minimum-32-characters-here!!'
process.env.TMDB_API_KEY = 'test-key'

import bcrypt from 'bcrypt'
import { createApp } from '../src/app'
import { Admin } from '../src/models/Admin'
import { setupTestDB, teardownTestDB, clearTestDB } from './helpers/db'

const app = createApp()

beforeAll(() => setupTestDB(), 60000)
afterAll(() => teardownTestDB(), 30000)
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
