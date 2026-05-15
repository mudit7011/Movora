import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Movie } from '../src/models/Movie'
import { Admin } from '../src/models/Admin'
import { ScrapeJob } from '../src/models/ScrapeJob'

process.env.MONGODB_URI = 'mongodb://localhost:27017/test'
process.env.JWT_SECRET = 'test-secret-minimum-32-characters-here!!'
process.env.TMDB_API_KEY = 'test-key'

let mongo: MongoMemoryServer

beforeAll(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
}, 60000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongo.stop()
}, 30000)

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
