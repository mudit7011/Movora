import request from 'supertest'

process.env.MONGODB_URI = 'mongodb://localhost:27017/test'
process.env.JWT_SECRET = 'test-secret-minimum-32-characters-here!!'
process.env.TMDB_API_KEY = 'test-key'

import { createApp } from '../src/app'
import { Movie } from '../src/models/Movie'
import { setupTestDB, teardownTestDB, clearTestDB } from './helpers/db'

const app = createApp()

beforeAll(() => setupTestDB(), 60000)
afterAll(() => teardownTestDB(), 30000)
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
  it('returns paginated movies without sources', async () => {
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
    const res = await request(app).get('/api/movies?language=Hindi+Dubbed')
    expect(res.body.movies).toHaveLength(1)
    expect(res.body.movies[0].title).toBe('Pushpa The Rise')
  })
})

describe('GET /api/movies/trending', () => {
  it('returns movies with rating >= 6', async () => {
    await Movie.create(movieFixture)
    const res = await request(app).get('/api/movies/trending')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0].title).toBe('Pushpa The Rise')
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
