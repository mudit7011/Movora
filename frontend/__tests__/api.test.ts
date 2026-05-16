import { api } from '@/lib/api'

const MOCK_MOVIES = [
  { _id: '1', title: 'Pushpa', slug: 'pushpa-2021', rating: 7.6, posterUrl: '', genres: [], language: [], releaseYear: 2021, sources: [] },
]

global.fetch = jest.fn()

afterEach(() => jest.clearAllMocks())

test('getTrending calls /api/movies/trending', async () => {
  ;(fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => MOCK_MOVIES,
  })
  const result = await api.getTrending()
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/movies/trending'),
    expect.any(Object)
  )
  expect(result).toEqual(MOCK_MOVIES)
})

test('getMovies passes query params', async () => {
  ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ movies: [], total: 0, page: 1, pages: 1 }) })
  await api.getMovies({ genre: 'Action', page: '2' })
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('genre=Action'),
    expect.any(Object)
  )
})

test('throws when response is not ok', async () => {
  ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 })
  await expect(api.getTrending()).rejects.toThrow('API error: 500')
})
