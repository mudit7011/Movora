export interface ScrapeJob {
  _id: string
  site: string
  status: 'running' | 'completed' | 'failed'
  moviesFound: number
  errors: string[]
  startedAt: string
  completedAt?: string
}
