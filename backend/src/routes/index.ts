import { Router } from 'express'
import { moviesRouter } from './movies'
import { showsRouter } from './shows'
import { newRouter } from './new'
import { adminAuthRouter } from './admin/auth'
import { adminMoviesRouter } from './admin/movies'
import { adminScrapeRouter } from './admin/scrape'

const router = Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

router.use('/movies', moviesRouter)
router.use('/shows', showsRouter)
router.use('/new', newRouter)
router.use('/admin/auth', adminAuthRouter)
router.use('/admin/movies', adminMoviesRouter)
router.use('/admin/scrape', adminScrapeRouter)

export { router as routes }
