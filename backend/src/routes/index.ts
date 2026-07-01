import { Router } from 'express'
import { moviesRouter } from './movies'
import { showsRouter } from './shows'
import { newRouter } from './new'
import { realtimeRouter } from './realtime'
import { searchRouter } from './search'
import { subtitlesRouter } from './subtitles'
import { streamRouter } from './stream'
import { sportsRouter } from './sports'
import { livetvRouter } from './livetv'
import { adminAuthRouter } from './admin/auth'
import { adminMoviesRouter } from './admin/movies'
import { adminScrapeRouter } from './admin/scrape'

const router = Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', host: 'render', region: 'singapore' })
})

router.use('/movies', moviesRouter)
router.use('/shows', showsRouter)
router.use('/new', newRouter)
router.use('/realtime', realtimeRouter)
router.use('/search', searchRouter)
router.use('/subtitles', subtitlesRouter)
router.use('/stream', streamRouter)
router.use('/sports', sportsRouter)
router.use('/livetv', livetvRouter)
router.use('/admin/auth', adminAuthRouter)
router.use('/admin/movies', adminMoviesRouter)
router.use('/admin/scrape', adminScrapeRouter)

export { router as routes }
