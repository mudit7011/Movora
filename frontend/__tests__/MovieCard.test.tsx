import { render, screen } from '@testing-library/react'
import MovieCard from '@/components/MovieCard'
import type { Movie } from '@/types/movie'

const MOCK_MOVIE: Movie = {
  _id: '1',
  tmdbId: 'tt123',
  title: 'Pushpa: The Rise',
  slug: 'pushpa-the-rise-2021',
  type: 'movie',
  language: ['Hindi'],
  genres: ['Action'],
  releaseYear: 2021,
  rating: 7.6,
  runtime: 179,
  synopsis: 'A labourer rises…',
  posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
  backdropUrl: '',
  cast: [],
  sources: [],
  scrapedFrom: 'streamvaults.ru',
  createdAt: '',
  updatedAt: '',
}

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ''} />,
}))

test('renders movie title', () => {
  render(<MovieCard movie={MOCK_MOVIE} />)
  expect(screen.getByText('Pushpa: The Rise')).toBeInTheDocument()
})

test('renders rating', () => {
  render(<MovieCard movie={MOCK_MOVIE} />)
  expect(screen.getByText('7.6')).toBeInTheDocument()
})

test('renders language tag', () => {
  render(<MovieCard movie={MOCK_MOVIE} />)
  expect(screen.getByText('Hindi')).toBeInTheDocument()
})

test('links to movie detail page', () => {
  render(<MovieCard movie={MOCK_MOVIE} />)
  expect(screen.getByRole('link')).toHaveAttribute('href', '/movie/pushpa-the-rise-2021')
})
