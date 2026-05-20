export interface Source {
  serverName: string
  url: string
  type: 'iframe' | 'direct'
  quality: string
  isWorking: boolean
}

export interface CastMember {
  name: string
  character?: string
  photo?: string
}

export interface SeasonInfo {
  seasonNumber: number
  episodeCount: number
  name: string
}

export interface EpisodeInfo {
  episodeNumber: number
  name: string
  overview: string
  runtime: number
  stillUrl: string
  airDate: string
}

export interface Movie {
  _id: string
  tmdbId: string
  title: string
  titleHindi?: string
  slug: string
  type: 'movie' | 'tvshow'
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
  // TV show specific
  seasons?: number
  totalEpisodes?: number
  status?: string
  seasonData?: SeasonInfo[]
  createdAt: string
  updatedAt: string
}

export interface PaginatedMovies {
  movies: Movie[]
  total: number
  page: number
  pages: number
}

export interface MovieFilters {
  genre?: string
  year?: string
  language?: string
  minRating?: string
  page?: string
  limit?: string
  sort?: string
}
