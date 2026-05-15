import request from 'supertest'

process.env.MONGODB_URI = 'mongodb://localhost:27017/test'
process.env.JWT_SECRET = 'test-secret-minimum-32-characters-here!!'
process.env.TMDB_API_KEY = 'test-key'

import { createApp } from '../src/app'
import { Movie } from '../src/models/Movie'
import { setupTestDB, teardownTestDB, clearTestDB } from './helpers/db'
import { generateTestToken } from './helpers/auth'

const app = createApp()
const token = generateTestToken()

beforeAll(() => setupTestDB(), 60000)
afterAll(() => teardownTestDB(), 30000)
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

describe('Admin movies — auth guard', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/admin/movies')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/admin/movies', () => {
  it('returns all movies including sources', async () => {
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
    const res = await request(app).patch(`/api/admin/movies/${movie._id}`).set('Authorization', `Bearer ${token}`).send({ rating: 9.0 })
    expect(res.status).toBe(200)
    expect(res.body.rating).toBe(9.0)
  })

  it('returns 404 for unknown id', async () => {
    const res = await request(app).patch('/api/admin/movies/000000000000000000000000').set('Authorization', `Bearer ${token}`).send({ rating: 9.0 })
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
