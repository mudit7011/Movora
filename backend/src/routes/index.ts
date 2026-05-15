import { Router } from 'express'
import { moviesRouter } from './movies'
import { adminAuthRouter } from './admin/auth'
import { adminMoviesRouter } from './admin/movies'
import { adminScrapeRouter } from './admin/scrape'

const router = Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

router.use('/movies', moviesRouter)
router.use('/admin/auth', adminAuthRouter)
router.use('/admin/movies', adminMoviesRouter)
router.use('/admin/scrape', adminScrapeRouter)

export { router as routes }
